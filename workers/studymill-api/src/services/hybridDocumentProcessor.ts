/**
 * Hybrid Document Processing Service
 * 
 * Intelligent selector between self-hosted processing and ParseExtract API
 * - Self-hosted: Fast, free, handles 80% of use cases (basic text extraction)
 * - ParseExtract: Advanced features (tables, image OCR) for complex documents
 */

import { SelfHostedPdfProcessor, PdfExtractionResult } from './selfHostedPdfProcessor';
import { SelfHostedDocxProcessor, DocxExtractionResult } from './selfHostedDocxProcessor';
import { ParseExtractService, ParseExtractResponse, DocumentChunk } from './parseExtract';
import { ProcessingErrorMapper } from '../utils/processing-errors';

export interface ProcessingOptions {
  // Processing preferences
  preferSelfHosted?: boolean;
  requireAdvancedFeatures?: boolean;
  enableFallback?: boolean;
  
  // Quality settings
  preserveFormatting?: boolean;
  extractMetadata?: boolean;
  
  // Cost controls
  maxCostPerDocument?: number;
  
  // Performance settings
  maxProcessingTime?: number; // milliseconds
}

export interface HybridProcessingResult {
  success: boolean;
  method: 'self-hosted' | 'parse-extract' | 'fallback';
  data?: {
    text: string;
    pages: number;
    pageTexts?: Array<{
      pageNumber: number;
      text: string;
      wordCount: number;
    }>;
    tables?: Array<{
      data: string[][];
      page: number;
    }>;
    images?: Array<{
      base64: string;
      page: number;
      description?: string;
    }>;
    metadata: Record<string, any>;
    processingTime: number;
    costEstimate?: number;
  };
  error?: string;
  recommendation?: string;
}

export class HybridDocumentProcessor {
  private selfHostedPdfProcessor: SelfHostedPdfProcessor;
  private selfHostedDocxProcessor: SelfHostedDocxProcessor;
  private parseExtractService: ParseExtractService | null = null;

  constructor(parseExtractApiKey?: string) {
    this.selfHostedPdfProcessor = new SelfHostedPdfProcessor();
    this.selfHostedDocxProcessor = new SelfHostedDocxProcessor();
    
    if (parseExtractApiKey) {
      this.parseExtractService = new ParseExtractService(parseExtractApiKey);
    }
  }

  /**
   * Process document using intelligent method selection
   */
  async processDocument(
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string,
    options: ProcessingOptions = {}
  ): Promise<HybridProcessingResult> {
    const startTime = Date.now();

    try {
      // Determine processing method
      const method = this.selectProcessingMethod(
        fileBuffer.byteLength,
        fileType,
        fileName,
        options
      );

      console.log(`Processing ${fileName} using ${method} method`, {
        fileSize: `${Math.round(fileBuffer.byteLength / 1024)}KB`,
        fileType,
        options
      });

      // Process based on selected method
      switch (method) {
        case 'self-hosted':
          return await this.processSelfHosted(fileBuffer, fileType, fileName, options, startTime);
          
        case 'parse-extract':
          return await this.processWithParseExtract(fileBuffer, fileType, fileName, options, startTime);
          
        case 'fallback':
          return await this.processWithFallback(fileBuffer, fileType, fileName, options, startTime);
          
        default:
          throw new Error(`Unknown processing method: ${method}`);
      }

    } catch (error) {
      console.error('Hybrid document processing failed:', error);
      
      return {
        success: false,
        method: 'self-hosted',
        error: error instanceof Error ? error.message : 'Document processing failed'
      };
    }
  }

  /**
   * Select optimal processing method based on document characteristics
   */
  private selectProcessingMethod(
    fileSize: number,
    fileType: string,
    fileName: string,
    options: ProcessingOptions
  ): 'self-hosted' | 'parse-extract' | 'fallback' {
    // Force ParseExtract if explicitly requested
    if (options.requireAdvancedFeatures && this.parseExtractService) {
      return 'parse-extract';
    }

    // Force self-hosted if preferred and no advanced features needed
    if (options.preferSelfHosted && !options.requireAdvancedFeatures) {
      return 'self-hosted';
    }

    // Both PDF and DOCX supported by self-hosted now (DOCX uses mammoth browser build)
    if (fileType !== 'application/pdf' && fileType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return this.parseExtractService ? 'parse-extract' : 'fallback';
    }

    // Use ParseExtract if no API available (fallback handles gracefully)
    if (!this.parseExtractService) {
      return fileSize > 50 * 1024 * 1024 ? 'fallback' : 'self-hosted';
    }

    // Decision matrix based on document characteristics
    const shouldUseParseExtract = SelfHostedPdfProcessor.shouldUseParseExtract(
      fileSize,
      fileName,
      options.requireAdvancedFeatures
    );

    if (shouldUseParseExtract) {
      return 'parse-extract';
    }

    // Cost consideration
    if (options.maxCostPerDocument !== undefined) {
      const estimatedCost = ParseExtractService.getProcessingCost(fileType, fileSize);
      if (estimatedCost > options.maxCostPerDocument) {
        return 'self-hosted';
      }
    }

    // Default to self-hosted for simple documents
    return 'self-hosted';
  }

  /**
   * Process using self-hosted processors (PDF or DOCX)
   */
  private async processSelfHosted(
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string,
    options: ProcessingOptions,
    startTime: number
  ): Promise<HybridProcessingResult> {
    try {
      let result: PdfExtractionResult | DocxExtractionResult;

      // Route to appropriate processor based on file type
      if (fileType === 'application/pdf') {
        result = await this.selfHostedPdfProcessor.processPdf(fileBuffer, fileName, {
          preserveFormatting: options.preserveFormatting,
          extractMetadata: options.extractMetadata
        });
      } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        result = await this.selfHostedDocxProcessor.processDocx(fileBuffer, fileName, {
          preserveImages: false, // For now, keep images disabled for performance
          convertToMarkdown: true,
          extractStructure: true,
          includeStyles: options.preserveFormatting,
          handleFootnotes: true
        });
      } else {
        throw new Error(`Unsupported file type for self-hosted processing: ${fileType}`);
      }

      if (!result.success || !result.data) {
        // Try fallback if enabled
        if (options.enableFallback && this.parseExtractService) {
          console.log('Self-hosted processing failed, falling back to ParseExtract');
          return await this.processWithParseExtract(
            fileBuffer, 
            fileType, 
            fileName, 
            options, 
            startTime
          );
        }
        
        throw new Error(result.error || 'Self-hosted processing failed');
      }

      return {
        success: true,
        method: 'self-hosted',
        data: {
          text: result.data.text,
          pages: 'pages' in result.data ? result.data.pages : 1,
          pageTexts: 'pageTexts' in result.data ? result.data.pageTexts : undefined,
          metadata: {
            ...result.data.metadata,
            processingMethod: 'self-hosted',
            extractionMethod: result.data.extractionMethod || result.data.metadata.extractionMethod
          },
          processingTime: result.data.processingTime || result.data.metadata.processingTime,
          costEstimate: 0 // Self-hosted is free
        }
      };

    } catch (error) {
      // Try fallback if enabled
      if (options.enableFallback && this.parseExtractService) {
        console.log('Self-hosted processing failed, falling back to ParseExtract:', error);
        return await this.processWithParseExtract(
          fileBuffer, 
          fileType, 
          fileName, 
          { ...options, preferSelfHosted: false }, 
          startTime
        );
      }
      
      throw error;
    }
  }

  /**
   * Process using ParseExtract API
   */
  private async processWithParseExtract(
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string,
    options: ProcessingOptions,
    startTime: number
  ): Promise<HybridProcessingResult> {
    if (!this.parseExtractService) {
      throw new Error('ParseExtract API not available');
    }

    try {
      const result = await this.parseExtractService.processDocument(
        fileBuffer,
        fileType,
        fileName
      );

      // Handle async processing if needed
      let finalResult = result;
      if (result.jobId && !result.data) {
        console.log(`Waiting for ParseExtract job: ${result.jobId}`);
        
        const maxWait = options.maxProcessingTime || 300000; // 5 minutes default
        const endTime = startTime + maxWait;
        
        while (Date.now() < endTime) {
          await this.delay(10000); // Wait 10 seconds
          
          const statusResult = await this.parseExtractService.checkJobStatus(result.jobId);
          
          if (statusResult.success && statusResult.data) {
            finalResult = statusResult;
            break;
          } else if (statusResult.error && statusResult.error !== 'Still processing') {
            throw new Error(statusResult.error);
          }
        }
        
        if (!finalResult.data) {
          throw new Error('ParseExtract processing timeout');
        }
      }

      if (!finalResult.success || !finalResult.data) {
        throw new Error(finalResult.error || 'ParseExtract processing failed');
      }

      const costEstimate = ParseExtractService.getProcessingCost(fileType, fileBuffer.byteLength);
      
      return {
        success: true,
        method: 'parse-extract',
        data: {
          text: finalResult.data.text,
          pages: finalResult.data.pages || 1,
          tables: finalResult.data.tables,
          images: finalResult.data.images,
          metadata: {
            processingMethod: 'parse-extract',
            hasAdvancedFeatures: !!(finalResult.data.tables?.length || finalResult.data.images?.length)
          },
          processingTime: Date.now() - startTime,
          costEstimate
        }
      };

    } catch (error) {
      throw ProcessingErrorMapper.mapGenericError(error, fileName, fileType);
    }
  }

  /**
   * Process with fallback strategy (no ParseExtract available)
   */
  private async processWithFallback(
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string,
    options: ProcessingOptions,
    startTime: number
  ): Promise<HybridProcessingResult> {
    // For PDF files, try self-hosted even if not optimal
    if (fileType === 'application/pdf') {
      try {
        return await this.processSelfHosted(fileBuffer, fileName, options, startTime);
      } catch (error) {
        return {
          success: false,
          method: 'fallback',
          error: `Self-hosted processing failed and ParseExtract not available: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recommendation: 'Configure ParseExtract API for advanced document processing capabilities'
        };
      }
    }

    // For non-PDF files without ParseExtract
    return {
      success: false,
      method: 'fallback',
      error: `File type ${fileType} requires ParseExtract API which is not configured`,
      recommendation: 'Configure ParseExtract API to process DOCX, images, and other file types'
    };
  }

  /**
   * Create unified document chunks from processing result
   */
  createDocumentChunks(
    documentId: string,
    result: HybridProcessingResult,
    options: ProcessingOptions = {}
  ): DocumentChunk[] {
    if (!result.success || !result.data) {
      return [];
    }

    switch (result.method) {
      case 'self-hosted':
        // Use appropriate chunking based on available data
        if (result.data.pageTexts) {
          // PDF chunking
          return this.selfHostedPdfProcessor.createDocumentChunks(
            documentId,
            {
              text: result.data.text,
              pages: result.data.pages,
              pageTexts: result.data.pageTexts,
              metadata: result.data.metadata,
              processingTime: result.data.processingTime,
              extractionMethod: 'self-hosted'
            }
          );
        } else {
          // DOCX chunking - create mock DOCX data structure
          return this.selfHostedDocxProcessor.createDocumentChunks(
            documentId,
            {
              text: result.data.text,
              markdown: result.data.text, // Fallback if no markdown
              html: result.data.text, // Fallback if no HTML
              images: [],
              metadata: result.data.metadata,
              structure: {
                headings: [],
                tables: [],
                footnotes: []
              }
            }
          );
        }
        break;

      case 'parse-extract':
        // Use ParseExtract chunking
        if (this.parseExtractService) {
          return this.parseExtractService.chunkContent(
            documentId,
            {
              text: result.data.text,
              pages: result.data.pages,
              tables: result.data.tables,
              images: result.data.images
            }
          );
        }
        break;
    }

    // Fallback: basic text chunking
    return this.createBasicTextChunks(documentId, result.data.text);
  }

  /**
   * Create basic text chunks as fallback
   */
  private createBasicTextChunks(documentId: string, text: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const maxChunkSize = 1000;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push({
            id: `${documentId}_chunk_${chunkIndex}`,
            documentId,
            chunkIndex: chunkIndex++,
            content: currentChunk + '.',
            contentType: 'text',
            characterCount: currentChunk.length,
            metadata: {
              sourceType: 'fallback_text',
              chunkingStrategy: 'sentence-based'
            }
          });
        }
        currentChunk = trimmedSentence;
      }
    }
    
    if (currentChunk) {
      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        chunkIndex: chunkIndex++,
        content: currentChunk + '.',
        contentType: 'text',
        characterCount: currentChunk.length,
        metadata: {
          sourceType: 'fallback_text',
          chunkingStrategy: 'sentence-based'
        }
      });
    }
    
    return chunks.filter(chunk => chunk.content.trim().length > 10);
  }

  /**
   * Get processing recommendations for a file
   */
  getProcessingRecommendation(
    fileSize: number,
    fileType: string,
    fileName: string
  ): {
    recommendedMethod: 'self-hosted' | 'parse-extract';
    reasons: string[];
    estimatedCost: number;
    estimatedTime: number; // seconds
  } {
    const reasons: string[] = [];
    let recommendedMethod: 'self-hosted' | 'parse-extract' = 'self-hosted';
    let estimatedCost = 0;
    let estimatedTime = 30; // seconds

    // File type considerations
    if (fileType !== 'application/pdf') {
      recommendedMethod = 'parse-extract';
      reasons.push(`File type ${fileType} requires ParseExtract API`);
      estimatedCost = ParseExtractService.getProcessingCost(fileType, fileSize);
      estimatedTime = fileSize > 10 * 1024 * 1024 ? 120 : 60;
    } else {
      // PDF-specific analysis
      if (fileSize > 20 * 1024 * 1024) {
        recommendedMethod = 'parse-extract';
        reasons.push('Large file size optimized for ParseExtract');
        estimatedCost = ParseExtractService.getProcessingCost(fileType, fileSize);
        estimatedTime = 180;
      } else if (SelfHostedPdfProcessor.shouldUseParseExtract(fileSize, fileName, false)) {
        recommendedMethod = 'parse-extract';
        reasons.push('Document likely contains complex layouts (tables, forms)');
        estimatedCost = ParseExtractService.getProcessingCost(fileType, fileSize);
        estimatedTime = 90;
      } else {
        reasons.push('Simple text extraction suitable for self-hosted processing');
        estimatedTime = Math.max(10, Math.ceil(fileSize / (1024 * 1024)) * 5);
      }
    }

    return {
      recommendedMethod,
      reasons,
      estimatedCost,
      estimatedTime
    };
  }

  /**
   * Private helper methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}