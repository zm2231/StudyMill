/**
 * Self-Hosted DOCX Processing Service
 * 
 * Provides comprehensive DOCX processing using Mammoth.js
 * Focuses on style preservation, structure extraction, and clean markdown conversion
 * Handles academic documents with footnotes, references, and complex formatting
 */

import { MAMMOTH_CONFIG, cleanMammothHtml, extractDocxMetadata } from '../config/mammoth-config';
import { ProcessingErrorMapper, FileValidator } from '../utils/processing-errors';
import { DocumentChunk, ChunkingConfig, DEFAULT_CHUNKING_CONFIG } from '../types/document-processing';

export interface DocxExtractionResult {
  success: boolean;
  data?: {
    text: string;
    markdown: string;
    html: string;
    images: Array<{
      id: string;
      alt?: string;
      title?: string;
      contentType: string;
      data: ArrayBuffer;
    }>;
    metadata: {
      wordCount: number;
      paragraphCount: number;
      headingCount: number;
      imageCount: number;
      conversionMessages?: Array<{
        type: string;
        message: string;
      }>;
      processingTime: number;
      extractionMethod: 'self-hosted-mammoth';
    };
    structure: {
      headings: Array<{
        level: number;
        text: string;
        id: string;
      }>;
      tables: Array<{
        rows: number;
        columns: number;
        content: string;
        position: number;
      }>;
      footnotes: Array<{
        id: string;
        text: string;
        position: number;
      }>;
    };
  };
  error?: string;
}

export interface DocxProcessingOptions {
  preserveImages?: boolean;
  convertToMarkdown?: boolean;
  extractStructure?: boolean;
  includeStyles?: boolean;
  handleFootnotes?: boolean;
  chunkingConfig?: ChunkingConfig;
}

export class SelfHostedDocxProcessor {
  private mammoth: any = null;

  constructor() {
    // Mammoth will be initialized on first use
  }

  /**
   * Initialize Mammoth browser build for Workers environment
   * Uses the Workers-compatible browser build instead of Node.js version
   */
  private async initializeMammoth() {
    if (!this.mammoth) {
      try {
        // Use the browser build which is compatible with Workers
        this.mammoth = await import('mammoth/mammoth.browser.min.js');
      } catch (error) {
        throw new Error(
          `Failed to initialize Mammoth browser build: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
    return this.mammoth;
  }

  /**
   * Process DOCX document and extract content
   */
  async processDocx(
    fileBuffer: ArrayBuffer,
    fileName: string,
    options: DocxProcessingOptions = {}
  ): Promise<DocxExtractionResult> {
    const startTime = Date.now();

    try {
      // Validate file
      FileValidator.validateFileName(fileName);
      FileValidator.validateFileSize(fileBuffer.byteLength, MAMMOTH_CONFIG.maxFileSize);

      // Initialize Mammoth
      const mammoth = await this.initializeMammoth();

      // Prepare conversion options
      const conversionOptions = await this.prepareConversionOptions(options);

      // Convert DOCX to HTML
      const htmlResult = await mammoth.convertToHtml(
        { arrayBuffer: fileBuffer },
        conversionOptions
      );

      if (!htmlResult.value) {
        throw ProcessingErrorMapper.mapGenericError(
          new Error('No content extracted from DOCX'),
          fileName,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
      }

      // Clean HTML output
      const cleanHtml = cleanMammothHtml(htmlResult.value);

      // Extract plain text
      const textResult = await mammoth.extractRawText(
        { arrayBuffer: fileBuffer },
        MAMMOTH_CONFIG.textOptions
      );

      // Extract images if requested
      const images = options.preserveImages 
        ? await this.extractImages(fileBuffer, mammoth)
        : [];

      // Convert to markdown if requested
      const markdown = options.convertToMarkdown
        ? await this.convertToMarkdown(cleanHtml)
        : '';

      // Extract document structure
      const structure = options.extractStructure
        ? await this.extractDocumentStructure(cleanHtml, textResult.value)
        : { headings: [], tables: [], footnotes: [] };

      // Generate metadata
      const baseMetadata = extractDocxMetadata(htmlResult);
      const processingTime = Date.now() - startTime;

      const metadata = {
        ...baseMetadata,
        imageCount: images.length,
        processingTime,
        extractionMethod: 'self-hosted-mammoth' as const,
        conversionMessages: htmlResult.messages?.map((msg: any) => ({
          type: msg.type,
          message: msg.message
        }))
      };

      return {
        success: true,
        data: {
          text: textResult.value || '',
          markdown,
          html: cleanHtml,
          images,
          metadata,
          structure
        }
      };

    } catch (error) {
      console.error('Self-hosted DOCX processing failed:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'DOCX processing failed'
      };
    }
  }

  /**
   * Prepare conversion options for Mammoth
   */
  private async prepareConversionOptions(options: DocxProcessingOptions): Promise<any> {
    const baseOptions = {
      styleMap: MAMMOTH_CONFIG.styleMap,
      includeDefaultStyleMap: MAMMOTH_CONFIG.convertOptions.includeDefaultStyleMap,
      includeEmbeddedStyleMap: MAMMOTH_CONFIG.convertOptions.includeEmbeddedStyleMap
    };

    // Image handling
    if (options.preserveImages) {
      const imageConverter = this.createImageConverter();
      baseOptions.convertImage = imageConverter;
    }

    // Custom style mappings for academic content
    if (options.includeStyles) {
      baseOptions.styleMap = [
        ...MAMMOTH_CONFIG.styleMap,
        // Academic-specific styles
        "p[style-name='Citation'] => .citation",
        "p[style-name='Reference'] => .reference",
        "p[style-name='Footnote Text'] => .footnote",
        "p[style-name='Equation'] => .equation",
        // Table styles
        "table => table.academic-table",
        "td => td",
        "th => th"
      ];
    }

    return baseOptions;
  }

  /**
   * Create image converter for Mammoth browser build
   */
  private createImageConverter() {
    return (image: any) => {
      // Store image data for later processing
      return image.read("base64").then((imageBuffer: string) => ({
        src: `data:${image.contentType};base64,${imageBuffer}`,
        alt: image.altText || '',
        title: image.title || ''
      }));
    };
  }

  /**
   * Extract images from DOCX document
   */
  private async extractImages(fileBuffer: ArrayBuffer, mammoth: any): Promise<Array<{
    id: string;
    alt?: string;
    title?: string;
    contentType: string;
    data: ArrayBuffer;
  }>> {
    try {
      const images: any[] = [];
      
      // Extract images using Mammoth's image extraction
      const result = await mammoth.images.extractImages({
        arrayBuffer: fileBuffer
      });

      for (let i = 0; i < result.length; i++) {
        const image = result[i];
        const imageData = await image.read('arrayBuffer');
        
        images.push({
          id: `docx_image_${i}`,
          alt: image.altText || undefined,
          title: image.title || undefined,
          contentType: image.contentType || 'image/unknown',
          data: imageData
        });
      }

      return images;
    } catch (error) {
      console.warn('Failed to extract images from DOCX:', error);
      return [];
    }
  }

  /**
   * Convert HTML to Markdown
   */
  private async convertToMarkdown(html: string): Promise<string> {
    try {
      const TurndownService = (await import('turndown')).default;
      
      const turndown = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        strongDelimiter: '**',
        emDelimiter: '*'
      });

      // Add custom rules for academic content
      turndown.addRule('academic-citations', {
        filter: ['cite', '.citation'],
        replacement: (content: string) => `*${content}*`
      });

      turndown.addRule('academic-footnotes', {
        filter: ['.footnote'],
        replacement: (content: string) => `[^footnote]: ${content}`
      });

      turndown.addRule('academic-references', {
        filter: ['.reference'],
        replacement: (content: string) => `\n---\n${content}\n---\n`
      });

      // Convert and clean up
      let markdown = turndown.turndown(html);
      
      // Clean up excessive whitespace
      markdown = markdown
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+$/gm, '')
        .trim();

      return markdown;
    } catch (error) {
      console.warn('Failed to convert to markdown:', error);
      return '';
    }
  }

  /**
   * Extract document structure (headings, tables, footnotes)
   */
  private async extractDocumentStructure(html: string, plainText: string): Promise<{
    headings: Array<{ level: number; text: string; id: string }>;
    tables: Array<{ rows: number; columns: number; content: string; position: number }>;
    footnotes: Array<{ id: string; text: string; position: number }>;
  }> {
    try {
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);

      // Extract headings
      const headings: Array<{ level: number; text: string; id: string }> = [];
      $('h1, h2, h3, h4, h5, h6').each((index, element) => {
        const $el = $(element);
        const level = parseInt(element.tagName.charAt(1));
        const text = $el.text().trim();
        const id = `heading_${index}_${level}`;
        
        if (text) {
          headings.push({ level, text, id });
        }
      });

      // Extract tables
      const tables: Array<{ rows: number; columns: number; content: string; position: number }> = [];
      $('table').each((index, element) => {
        const $table = $(element);
        const rows = $table.find('tr').length;
        const firstRow = $table.find('tr').first();
        const columns = firstRow.find('td, th').length;
        const content = $table.text().trim();
        
        tables.push({
          rows,
          columns,
          content,
          position: index
        });
      });

      // Extract footnotes
      const footnotes: Array<{ id: string; text: string; position: number }> = [];
      $('.footnote, [class*="footnote"]').each((index, element) => {
        const $el = $(element);
        const text = $el.text().trim();
        
        if (text) {
          footnotes.push({
            id: `footnote_${index}`,
            text,
            position: index
          });
        }
      });

      return { headings, tables, footnotes };
    } catch (error) {
      console.warn('Failed to extract document structure:', error);
      return { headings: [], tables: [], footnotes: [] };
    }
  }

  /**
   * Create document chunks from extracted DOCX content
   */
  createDocumentChunks(
    documentId: string,
    extractedData: DocxExtractionResult['data'],
    chunkingConfig: ChunkingConfig = DEFAULT_CHUNKING_CONFIG.academic
  ): DocumentChunk[] {
    if (!extractedData) {
      return [];
    }

    const chunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    // Strategy 1: Structure-based chunking using headings
    if (extractedData.structure.headings.length > 0) {
      return this.createStructureBasedChunks(documentId, extractedData, chunkingConfig);
    }

    // Strategy 2: Content-based chunking for documents without clear structure
    const contentChunks = this.createContentBasedChunks(
      extractedData.text,
      chunkingConfig
    );

    contentChunks.forEach(chunk => {
      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        chunkIndex: chunkIndex++,
        content: chunk.text,
        contentType: 'text',
        characterCount: chunk.text.length,
        metadata: {
          sourceType: 'docx-content',
          chunkingStrategy: 'content-based',
          confidence: chunk.confidence
        }
      });
    });

    // Add table chunks
    extractedData.structure.tables.forEach((table, tableIndex) => {
      chunks.push({
        id: `${documentId}_table_${tableIndex}`,
        documentId,
        chunkIndex: chunkIndex++,
        content: table.content,
        contentType: 'table',
        characterCount: table.content.length,
        metadata: {
          sourceType: 'docx-table',
          tableInfo: {
            rows: table.rows,
            columns: table.columns,
            position: table.position
          }
        }
      });
    });

    // Add footnote chunks
    extractedData.structure.footnotes.forEach((footnote, footnoteIndex) => {
      chunks.push({
        id: `${documentId}_footnote_${footnoteIndex}`,
        documentId,
        chunkIndex: chunkIndex++,
        content: footnote.text,
        contentType: 'text',
        characterCount: footnote.text.length,
        metadata: {
          sourceType: 'docx-footnote',
          footnoteId: footnote.id,
          position: footnote.position
        }
      });
    });

    return chunks;
  }

  /**
   * Create structure-based chunks using document headings
   */
  private createStructureBasedChunks(
    documentId: string,
    extractedData: DocxExtractionResult['data']!,
    config: ChunkingConfig
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const headings = extractedData.structure.headings;
    const fullText = extractedData.text;
    
    // Split text by headings to create sections
    const sections: Array<{
      heading: { level: number; text: string; id: string };
      content: string;
      startPos: number;
      endPos: number;
    }> = [];

    headings.forEach((heading, index) => {
      const headingPos = fullText.indexOf(heading.text);
      if (headingPos === -1) return;

      const nextHeading = headings[index + 1];
      const endPos = nextHeading 
        ? fullText.indexOf(nextHeading.text, headingPos + heading.text.length)
        : fullText.length;

      const content = fullText.substring(headingPos, endPos).trim();
      
      sections.push({
        heading,
        content,
        startPos: headingPos,
        endPos
      });
    });

    // Create chunks from sections
    sections.forEach((section, sectionIndex) => {
      if (section.content.length <= config.maxChunkSize) {
        // Section fits in one chunk
        chunks.push({
          id: `${documentId}_section_${sectionIndex}`,
          documentId,
          chunkIndex: chunks.length,
          content: section.content,
          contentType: section.heading.level === 1 ? 'heading' : 'text',
          characterCount: section.content.length,
          metadata: {
            sourceType: 'docx-section',
            heading: section.heading,
            chunkingStrategy: 'structure-based',
            sectionIndex
          }
        });
      } else {
        // Split large section into smaller chunks
        const subChunks = this.createContentBasedChunks(section.content, config);
        
        subChunks.forEach((subChunk, subIndex) => {
          chunks.push({
            id: `${documentId}_section_${sectionIndex}_${subIndex}`,
            documentId,
            chunkIndex: chunks.length,
            content: subChunk.text,
            contentType: 'text',
            characterCount: subChunk.text.length,
            metadata: {
              sourceType: 'docx-section-part',
              parentHeading: section.heading,
              chunkingStrategy: 'structure-based',
              sectionIndex,
              subChunkIndex: subIndex,
              confidence: subChunk.confidence
            }
          });
        });
      }
    });

    return chunks;
  }

  /**
   * Create content-based chunks for documents without clear structure
   */
  private createContentBasedChunks(
    text: string,
    config: ChunkingConfig
  ): Array<{ text: string; confidence: number }> {
    const chunks: Array<{ text: string; confidence: number }> = [];
    
    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      if (currentChunk.length + trimmedParagraph.length > config.maxChunkSize) {
        // Finalize current chunk if it meets minimum size
        if (currentChunk.length >= config.minChunkSize) {
          chunks.push({
            text: currentChunk.trim(),
            confidence: this.calculateChunkConfidence(currentChunk, trimmedParagraph)
          });
          
          // Start new chunk with overlap
          const overlapText = this.extractOverlap(currentChunk, config.overlapSize);
          currentChunk = overlapText + trimmedParagraph;
        } else {
          // Current chunk too small, add paragraph anyway
          currentChunk += '\n\n' + trimmedParagraph;
        }
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
      }
    }

    // Add final chunk
    if (currentChunk.trim().length >= config.minChunkSize) {
      chunks.push({
        text: currentChunk.trim(),
        confidence: 0.9 // High confidence for final chunk
      });
    }

    return chunks;
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
    if (currentChunk.length >= 300 && currentChunk.length <= 1200) {
      score += 0.1;
    }
    
    // Bonus for ending with complete sentence
    if (/[.!?]\s*$/.test(currentChunk.trim())) {
      score += 0.1;
    }
    
    // Penalty for very short chunks
    if (currentChunk.length < 100) {
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
    if (fileSize > 50 * 1024 * 1024) { // > 50MB
      return true;
    }
    
    // Use ParseExtract if advanced features explicitly requested
    if (requireAdvancedFeatures) {
      return true;
    }
    
    // Use ParseExtract for documents likely to have complex layouts
    const fileName_lower = fileName.toLowerCase();
    const complexLayoutKeywords = [
      'template', 'form', 'legal', 'contract', 'proposal',
      'technical', 'manual', 'specification', 'report'
    ];
    
    return complexLayoutKeywords.some(keyword => fileName_lower.includes(keyword));
  }
}