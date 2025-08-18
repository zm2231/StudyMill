/**
 * Self-Hosted PDF Processing Service
 * 
 * Provides fast, zero-cost PDF text extraction using PDF.js
 * Focuses on text extraction and basic formatting preservation
 * For advanced features (tables, image OCR), use ParseExtract as fallback
 */

import { configurePdfJs, PDF_CONFIG } from '../config/pdfjs-config';
import { ProcessingErrorMapper, FileValidator } from '../utils/processing-errors';
import { DocumentChunk, ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from '../types/document-processing';

export interface PdfExtractionResult {
  success: boolean;
  data?: {
    text: string;
    pages: number;
    pageTexts: Array<{
      pageNumber: number;
      text: string;
      wordCount: number;
    }>;
    metadata: {
      title?: string;
      author?: string;
      subject?: string;
      creator?: string;
      producer?: string;
      creationDate?: string;
      modificationDate?: string;
    };
    processingTime: number;
    extractionMethod: 'self-hosted';
  };
  error?: string;
}

export interface PdfProcessingOptions {
  maxPages?: number;
  preserveFormatting?: boolean;
  extractMetadata?: boolean;
  chunkingConfig?: ChunkingConfig;
}

export class SelfHostedPdfProcessor {
  private pdfjs: any = null;

  constructor() {
    // PDF.js will be initialized on first use
  }

  /**
   * Initialize PDF.js for Workers environment
   */
  private async initializePdfJs() {
    if (!this.pdfjs) {
      this.pdfjs = await configurePdfJs();
    }
    return this.pdfjs;
  }

  /**
   * Process PDF document and extract text content
   */
  async processPdf(
    fileBuffer: ArrayBuffer,
    fileName: string,
    options: PdfProcessingOptions = {}
  ): Promise<PdfExtractionResult> {
    const startTime = Date.now();

    try {
      // Validate file
      FileValidator.validateFileName(fileName);
      FileValidator.validateFileSize(fileBuffer.byteLength, PDF_CONFIG.maxFileSize);

      // Initialize PDF.js
      const pdfjs = await this.initializePdfJs();

      // Load PDF document
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(fileBuffer),
        ...PDF_CONFIG.loadOptions
      });

      const pdf = await loadingTask.promise;

      // Check page count
      const numPages = pdf.numPages;
      const maxPages = options.maxPages || PDF_CONFIG.maxPages;
      
      if (numPages > maxPages) {
        throw ProcessingErrorMapper.mapGenericError(
          new Error(`Document has ${numPages} pages, exceeding limit of ${maxPages}`),
          fileName,
          'application/pdf'
        );
      }

      // Extract metadata if requested
      let metadata = {};
      if (options.extractMetadata !== false) {
        try {
          const pdfMetadata = await pdf.getMetadata();
          metadata = this.extractPdfMetadata(pdfMetadata);
        } catch (metaError) {
          console.warn('Failed to extract PDF metadata:', metaError);
        }
      }

      // Extract text from all pages
      const pageTexts: Array<{
        pageNumber: number;
        text: string;
        wordCount: number;
      }> = [];

      let fullText = '';

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent(PDF_CONFIG.textOptions);
          
          const pageText = this.extractTextFromPage(textContent, options.preserveFormatting);
          const wordCount = pageText.split(/\s+/).filter(word => word.length > 0).length;

          pageTexts.push({
            pageNumber: pageNum,
            text: pageText,
            wordCount
          });

          fullText += pageText + '\n\n';

        } catch (pageError) {
          console.warn(`Failed to extract text from page ${pageNum}:`, pageError);
          pageTexts.push({
            pageNumber: pageNum,
            text: `[Page ${pageNum}: Text extraction failed]`,
            wordCount: 0
          });
        }
      }

      // Clean up full text
      fullText = fullText.trim();

      if (!fullText || fullText.length < 10) {
        throw ProcessingErrorMapper.mapGenericError(
          new Error('No readable text content found in PDF'),
          fileName,
          'application/pdf'
        );
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          text: fullText,
          pages: numPages,
          pageTexts,
          metadata: metadata as any,
          processingTime,
          extractionMethod: 'self-hosted'
        }
      };

    } catch (error) {
      console.error('Self-hosted PDF processing failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF processing failed'
      };
    }
  }

  /**
   * Extract text from a single page with optional formatting preservation
   */
  private extractTextFromPage(textContent: any, preserveFormatting: boolean = true): string {
    if (!textContent || !textContent.items) {
      return '';
    }

    if (!preserveFormatting) {
      // Simple text extraction without formatting
      return textContent.items
        .map((item: any) => item.str || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Advanced formatting preservation
    const lines: Array<{
      y: number;
      x: number;
      text: string;
      fontName?: string;
      fontSize?: number;
    }> = [];

    // Group text items by approximate line position
    textContent.items.forEach((item: any) => {
      if (item.str && item.str.trim()) {
        lines.push({
          y: item.transform[5], // Y position
          x: item.transform[4], // X position
          text: item.str,
          fontName: item.fontName,
          fontSize: item.height
        });
      }
    });

    // Sort by Y position (top to bottom), then X position (left to right)
    lines.sort((a, b) => {
      const yDiff = Math.abs(a.y - b.y);
      if (yDiff < 5) { // Same line tolerance
        return a.x - b.x;
      }
      return b.y - a.y; // Higher Y = top of page
    });

    // Group into text lines and preserve structure
    const textLines: string[] = [];
    let currentLine = '';
    let lastY = lines[0]?.y || 0;

    lines.forEach((item, index) => {
      const yDiff = Math.abs(item.y - lastY);
      
      if (yDiff > 5 && currentLine.trim()) {
        // New line detected
        textLines.push(currentLine.trim());
        currentLine = item.text;
      } else {
        // Same line, add space if needed
        const needsSpace = currentLine && 
                         !currentLine.endsWith(' ') && 
                         !item.text.startsWith(' ') &&
                         !/[.!?]$/.test(currentLine) &&
                         !/^[,;:]/.test(item.text);
        
        currentLine += (needsSpace ? ' ' : '') + item.text;
      }
      
      lastY = item.y;
    });

    // Add final line
    if (currentLine.trim()) {
      textLines.push(currentLine.trim());
    }

    // Join lines with appropriate spacing
    return textLines
      .filter(line => line.length > 0)
      .map(line => line.replace(/\s+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim();
  }

  /**
   * Extract metadata from PDF document
   */
  private extractPdfMetadata(pdfMetadata: any): Record<string, any> {
    const metadata: Record<string, any> = {};

    if (pdfMetadata?.info) {
      const info = pdfMetadata.info;
      
      metadata.title = info.Title || '';
      metadata.author = info.Author || '';
      metadata.subject = info.Subject || '';
      metadata.creator = info.Creator || '';
      metadata.producer = info.Producer || '';
      
      // Convert PDF dates to ISO strings
      if (info.CreationDate) {
        metadata.creationDate = this.parsePdfDate(info.CreationDate);
      }
      if (info.ModDate) {
        metadata.modificationDate = this.parsePdfDate(info.ModDate);
      }
    }

    return metadata;
  }

  /**
   * Parse PDF date format to ISO string
   */
  private parsePdfDate(pdfDate: string): string {
    try {
      // PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
      if (pdfDate.startsWith('D:')) {
        const dateStr = pdfDate.substring(2, 16); // YYYYMMDDHHMMSS
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const hour = dateStr.substring(8, 10) || '00';
        const minute = dateStr.substring(10, 12) || '00';
        const second = dateStr.substring(12, 14) || '00';
        
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
      }
      
      // Fallback: try to parse as regular date
      return new Date(pdfDate).toISOString();
    } catch {
      return pdfDate; // Return original if parsing fails
    }
  }

  /**
   * Create document chunks from extracted PDF content
   */
  createDocumentChunks(
    documentId: string,
    extractedData: PdfExtractionResult['data'],
    chunkingConfig: ChunkingConfig = DEFAULT_CHUNKING_CONFIG.academic
  ): DocumentChunk[] {
    if (!extractedData) {
      return [];
    }

    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    // Strategy 1: Chunk by pages for shorter documents
    if (extractedData.pages <= 10) {
      extractedData.pageTexts.forEach(pageData => {
        if (pageData.text.trim().length > chunkingConfig.minChunkSize) {
          chunks.push({
            id: `${documentId}_page_${pageData.pageNumber}`,
            documentId,
            chunkIndex: chunkIndex++,
            content: pageData.text,
            contentType: 'text',
            pageNumber: pageData.pageNumber,
            characterCount: pageData.text.length,
            metadata: {
              sourceType: 'page',
              wordCount: pageData.wordCount,
              chunkingStrategy: 'page-based'
            }
          });
        }
      });
    } else {
      // Strategy 2: Smart chunking for longer documents
      const smartChunks = this.createSmartChunks(
        extractedData.text,
        extractedData.pageTexts,
        chunkingConfig
      );

      smartChunks.forEach(chunk => {
        chunks.push({
          id: `${documentId}_chunk_${chunkIndex}`,
          documentId,
          chunkIndex: chunkIndex++,
          content: chunk.text,
          contentType: 'text',
          pageNumber: chunk.primaryPage,
          characterCount: chunk.text.length,
          metadata: {
            sourceType: 'smart-chunk',
            pageRange: chunk.pageRange,
            chunkingStrategy: 'content-aware',
            confidence: chunk.confidence
          }
        });
      });
    }

    return chunks;
  }

  /**
   * Create smart content-aware chunks
   */
  private createSmartChunks(
    fullText: string,
    pageTexts: Array<{ pageNumber: number; text: string; wordCount: number }>,
    config: ChunkingConfig
  ): Array<{
    text: string;
    primaryPage: number;
    pageRange: string;
    confidence: number;
  }> {
    const chunks: Array<{
      text: string;
      primaryPage: number;
      pageRange: string;
      confidence: number;
    }> = [];

    // Split text into paragraphs
    const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    let chunkPages: Set<number> = new Set();
    let currentPageIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      // Check if adding this paragraph would exceed chunk size
      if (currentChunk.length + trimmedParagraph.length > config.maxChunkSize) {
        // Finalize current chunk if it meets minimum size
        if (currentChunk.length >= config.minChunkSize) {
          chunks.push({
            text: currentChunk.trim(),
            primaryPage: this.findPrimaryPage(currentChunk, pageTexts),
            pageRange: Array.from(chunkPages).sort((a, b) => a - b).join('-'),
            confidence: this.calculateChunkConfidence(currentChunk, trimmedParagraph)
          });
          
          // Start new chunk with overlap
          const overlapText = this.extractOverlap(currentChunk, config.overlapSize);
          currentChunk = overlapText + trimmedParagraph;
          chunkPages = new Set([this.findPrimaryPage(currentChunk, pageTexts)]);
        } else {
          // Current chunk too small, add paragraph anyway
          currentChunk += '\n\n' + trimmedParagraph;
          chunkPages.add(this.findPrimaryPage(trimmedParagraph, pageTexts));
        }
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
        chunkPages.add(this.findPrimaryPage(trimmedParagraph, pageTexts));
      }
    }

    // Add final chunk
    if (currentChunk.trim().length >= config.minChunkSize) {
      chunks.push({
        text: currentChunk.trim(),
        primaryPage: this.findPrimaryPage(currentChunk, pageTexts),
        pageRange: Array.from(chunkPages).sort((a, b) => a - b).join('-'),
        confidence: 0.9 // High confidence for final chunk
      });
    }

    return chunks;
  }

  /**
   * Find which page contains most of the given text
   */
  private findPrimaryPage(
    text: string,
    pageTexts: Array<{ pageNumber: number; text: string; wordCount: number }>
  ): number {
    let bestMatch = { page: 1, score: 0 };
    
    pageTexts.forEach(pageData => {
      const textWords = text.toLowerCase().split(/\s+/);
      const pageWords = pageData.text.toLowerCase().split(/\s+/);
      
      const commonWords = textWords.filter(word => 
        word.length > 3 && pageWords.includes(word)
      );
      
      const score = commonWords.length / Math.max(textWords.length, 1);
      
      if (score > bestMatch.score) {
        bestMatch = { page: pageData.pageNumber, score };
      }
    });
    
    return bestMatch.page;
  }

  /**
   * Extract overlap text for chunk continuity
   */
  private extractOverlap(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }
    
    // Try to break at sentence boundary
    const lastPart = text.slice(-overlapSize * 2);
    const sentences = lastPart.split(/[.!?]+/);
    
    if (sentences.length > 1) {
      return sentences.slice(-2).join('.').trim() + '. ';
    }
    
    // Fallback to character-based overlap
    return text.slice(-overlapSize).trim() + ' ';
  }

  /**
   * Calculate confidence score for chunk quality
   */
  private calculateChunkConfidence(currentChunk: string, nextParagraph: string): number {
    let score = 0.8; // Base score
    
    // Bonus for good chunk size
    if (currentChunk.length >= 500 && currentChunk.length <= 1500) {
      score += 0.1;
    }
    
    // Bonus for ending with complete sentence
    if (/[.!?]\s*$/.test(currentChunk.trim())) {
      score += 0.1;
    }
    
    // Penalty for very short chunks
    if (currentChunk.length < 200) {
      score -= 0.2;
    }
    
    return Math.min(1.0, Math.max(0.1, score));
  }

  /**
   * Check if document should use ParseExtract for advanced features
   */
  static shouldUseParseExtract(
    fileSize: number,
    fileName: string,
    requireAdvancedFeatures: boolean = false
  ): boolean {
    // Use ParseExtract for very large documents
    if (fileSize > 20 * 1024 * 1024) { // > 20MB
      return true;
    }
    
    // Use ParseExtract if advanced features explicitly requested
    if (requireAdvancedFeatures) {
      return true;
    }
    
    // Use ParseExtract for documents likely to have complex layouts
    const fileName_lower = fileName.toLowerCase();
    const complexLayoutKeywords = [
      'financial', 'report', 'statement', 'invoice', 'form',
      'table', 'chart', 'diagram', 'technical', 'manual'
    ];
    
    return complexLayoutKeywords.some(keyword => fileName_lower.includes(keyword));
  }
}