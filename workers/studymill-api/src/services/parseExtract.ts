import { createError } from '../middleware/error';

export interface ParseExtractRequest {
  documentId: string;
  fileKey: string;
  fileType: string;
  fileName: string;
}

export interface ParseExtractResponse {
  success: boolean;
  jobId?: string;
  data?: {
    text: string;
    pages?: number;
    tables?: Array<{
      data: string[][];
      page: number;
    }>;
    images?: Array<{
      base64: string;
      page: number;
      description?: string;
    }>;
  };
  error?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  contentType: 'text' | 'table' | 'heading' | 'list';
  pageNumber?: number;
  characterCount: number;
  metadata?: Record<string, any>;
}

export class ParseExtractService {
  private static readonly BASE_URL = 'https://api.parseextract.com';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 2000; // 2 seconds

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('ParseExtract API key is required');
    }
  }

  /**
   * Process a document using ParseExtract API
   */
  async processDocument(fileBuffer: ArrayBuffer, fileType: string, fileName: string): Promise<ParseExtractResponse> {
    try {
      // Determine the endpoint and prepare form data based on file type
      const { endpoint, formData } = this.prepareRequest(fileType, fileName);
      
      const response = await this.makeApiRequest(endpoint, fileBuffer, formData);

      if (!response.success) {
        throw new Error(response.error || 'Document processing failed');
      }

      return response;

    } catch (error) {
      console.error('ParseExtract processing error:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Check the status of an async processing job and fetch results
   */
  async checkJobStatus(jobId: string, endpoint: string = '/v1/fetchoutput'): Promise<ParseExtractResponse> {
    try {
      // Use GET request with query parameter as per documentation
      const response = await fetch(`${ParseExtractService.BASE_URL}${endpoint}?job_id=${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Job status check failed: ${response.status}`);
      }

      const result = await response.json();

      // According to docs, completed jobs return text and images directly
      if (result.text || result.images) {
        return {
          success: true,
          data: {
            text: result.text || '',
            pages: result.pages,
            tables: result.tables,
            images: result.images
          }
        };
      } else {
        // Still processing or failed
        return {
          success: false,
          jobId: jobId,
          error: result.error || 'Still processing'
        };
      }

    } catch (error) {
      console.error('Job status check error:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Chunk processed content for vector embedding
   */
  chunkContent(
    documentId: string, 
    extractedData: ParseExtractResponse['data'], 
    maxChunkSize: number = 1000
  ): DocumentChunk[] {
    if (!extractedData) {
      return [];
    }

    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    // Process main text content
    if (extractedData.text) {
      const textChunks = this.splitTextIntoChunks(extractedData.text, maxChunkSize);
      
      textChunks.forEach((chunkText, index) => {
        chunks.push({
          id: `${documentId}_chunk_${chunkIndex}`,
          documentId,
          chunkIndex,
          content: chunkText,
          contentType: 'text',
          characterCount: chunkText.length,
          metadata: {
            sourceType: 'main_text',
            chunkPosition: index
          }
        });
        chunkIndex++;
      });
    }

    // Process extracted tables
    if (extractedData.tables) {
      extractedData.tables.forEach((table, tableIndex) => {
        const tableText = this.tableToText(table.data);
        
        chunks.push({
          id: `${documentId}_chunk_${chunkIndex}`,
          documentId,
          chunkIndex,
          content: tableText,
          contentType: 'table',
          pageNumber: table.page,
          characterCount: tableText.length,
          metadata: {
            sourceType: 'table',
            tableIndex,
            tableStructure: table.data
          }
        });
        chunkIndex++;
      });
    }

    // Process images with descriptions
    if (extractedData.images) {
      extractedData.images.forEach((image, imageIndex) => {
        if (image.description) {
          chunks.push({
            id: `${documentId}_chunk_${chunkIndex}`,
            documentId,
            chunkIndex,
            content: image.description,
            contentType: 'text',
            pageNumber: image.page,
            characterCount: image.description.length,
            metadata: {
              sourceType: 'image_description',
              imageIndex,
              hasBase64: !!image.base64
            }
          });
          chunkIndex++;
        }
      });
    }

    return chunks;
  }

  /**
   * Private helper methods
   */
  private async makeApiRequest(endpoint: string, fileBuffer: ArrayBuffer, formData: any, retryCount = 0): Promise<ParseExtractResponse> {
    try {
      // Create FormData for file upload
      const form = new FormData();
      
      // Add file as blob
      const blob = new Blob([fileBuffer]);
      form.append('file', blob, formData.filename || 'document');
      
      // Add other form data parameters
      Object.keys(formData).forEach(key => {
        if (key !== 'filename') {
          form.append(key, formData[key]);
        }
      });

      const response = await fetch(`${ParseExtractService.BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
          // Don't set Content-Type, let browser set it with boundary for FormData
        },
        body: form
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `API request failed: ${response.status}`);
      }

      // For documents >5 pages, we get a job_id (async processing)
      if (result.job_id) {
        return {
          success: true,
          jobId: result.job_id
        };
      }

      // For documents ≤5 pages, we get the data directly (sync processing)
      return {
        success: true,
        data: {
          text: result.text || '',
          pages: result.pages,
          tables: result.tables,
          images: result.images
        }
      };

    } catch (error) {
      if (retryCount < ParseExtractService.MAX_RETRIES) {
        console.warn(`API request failed, retrying (${retryCount + 1}/${ParseExtractService.MAX_RETRIES}):`, error);
        await this.delay(ParseExtractService.RETRY_DELAY * (retryCount + 1));
        return this.makeApiRequest(endpoint, fileBuffer, formData, retryCount + 1);
      }
      throw error;
    }
  }

  private prepareRequest(fileType: string, fileName: string): { endpoint: string; formData: any } {
    switch (fileType) {
      case 'application/pdf':
        return {
          endpoint: '/v1/pdf-parse',
          formData: {
            pdf_option: 'option_b', // Use option_b as per docs
            inline_images: true,
            get_base64_images: true,
            filename: fileName
          }
        };
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return {
          endpoint: '/v1/pdf-parse', // DOCX also uses pdf-parse endpoint
          formData: {
            pdf_option: 'option_b',
            inline_images: true,
            get_base64_images: true,
            filename: fileName
          }
        };
      
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/webp':
        return {
          endpoint: '/v1/image-parse',
          formData: {
            image_option: 'option_b',
            filename: fileName
          }
        };
      
      default:
        throw new Error(`Unsupported file type for processing: ${fileType}`);
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binary);
  }

  private splitTextIntoChunks(text: string, maxSize: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentChunk.length + trimmedSentence.length + 1 <= maxSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        
        // Handle very long sentences
        if (trimmedSentence.length > maxSize) {
          const words = trimmedSentence.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            if (wordChunk.length + word.length + 1 <= maxSize) {
              wordChunk += (wordChunk ? ' ' : '') + word;
            } else {
              if (wordChunk) {
                chunks.push(wordChunk);
              }
              wordChunk = word;
            }
          }
          
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        } else {
          currentChunk = trimmedSentence;
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  private tableToText(tableData: string[][]): string {
    return tableData
      .map(row => row.join(' | '))
      .join('\n');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private handleApiError(error: any): Error {
    if (error.message?.includes('rate limit')) {
      return createError('Document processing rate limit exceeded', 429);
    }
    
    if (error.message?.includes('quota')) {
      return createError('Document processing quota exceeded', 402);
    }
    
    if (error.message?.includes('unauthorized')) {
      return createError('Document processing service unavailable', 503);
    }
    
    return createError('Document processing failed', 500, { originalError: error.message });
  }

  /**
   * Static utility methods
   */
  static isProcessableFileType(fileType: string): boolean {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    return supportedTypes.includes(fileType);
  }

  static getProcessingCost(fileType: string, fileSizeBytes: number): number {
    // Estimate cost based on ParseExtract pricing
    // $1.25 per 1000 pages, assume 1 page per MB for estimation
    const estimatedPages = Math.max(1, Math.ceil(fileSizeBytes / (1024 * 1024)));
    return (estimatedPages / 1000) * 1.25;
  }
}