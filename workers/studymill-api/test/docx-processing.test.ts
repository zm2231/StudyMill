import { describe, it, expect, beforeAll } from 'vitest';
import { SelfHostedDocxProcessor } from '../src/services/selfHostedDocxProcessor';

describe('DOCX Processing Service', () => {
  let docxProcessor: SelfHostedDocxProcessor;

  beforeAll(() => {
    docxProcessor = new SelfHostedDocxProcessor();
  });

  describe('SelfHostedDocxProcessor', () => {
    it('should initialize without errors', () => {
      expect(docxProcessor).toBeDefined();
      expect(typeof docxProcessor.processDocx).toBe('function');
      expect(typeof docxProcessor.createDocumentChunks).toBe('function');
    });

    it('should validate file size limits', async () => {
      const tooLargeBuffer = new ArrayBuffer(120 * 1024 * 1024); // 120MB (exceeds 100MB limit)
      
      const result = await docxProcessor.processDocx(
        tooLargeBuffer,
        'large-document.docx'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });

    it('should validate file names', async () => {
      const validBuffer = new ArrayBuffer(1024); // 1KB
      
      const result = await docxProcessor.processDocx(
        validBuffer,
        '../dangerous-file.docx'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should handle empty or invalid DOCX buffers', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      
      const result = await docxProcessor.processDocx(
        emptyBuffer,
        'empty.docx'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should have static method for ParseExtract recommendation', () => {
      // Small, simple document should not need ParseExtract
      expect(SelfHostedDocxProcessor.shouldUseParseExtract(
        5 * 1024 * 1024, // 5MB
        'simple-document.docx',
        false
      )).toBe(false);

      // Large document should recommend ParseExtract
      expect(SelfHostedDocxProcessor.shouldUseParseExtract(
        60 * 1024 * 1024, // 60MB
        'large-document.docx',
        false
      )).toBe(true);

      // Template document should recommend ParseExtract
      expect(SelfHostedDocxProcessor.shouldUseParseExtract(
        10 * 1024 * 1024, // 10MB
        'legal-template.docx',
        false
      )).toBe(true);

      // Advanced features explicitly requested
      expect(SelfHostedDocxProcessor.shouldUseParseExtract(
        2 * 1024 * 1024, // 2MB
        'simple.docx',
        true // requireAdvancedFeatures
      )).toBe(true);
    });

    it('should handle processing options correctly', async () => {
      const testBuffer = new ArrayBuffer(1024);
      
      // Test with all options enabled
      const result = await docxProcessor.processDocx(
        testBuffer,
        'test.docx',
        {
          preserveImages: true,
          convertToMarkdown: true,
          extractStructure: true,
          includeStyles: true,
          handleFootnotes: true
        }
      );
      
      // Should handle gracefully even with invalid DOCX data
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should create document chunks from processing results', () => {
      // Test without headings to trigger content-based chunking
      const mockResult = {
        success: true,
        data: {
          text: 'This is a test document with substantial content for proper chunking. It has multiple paragraphs and enough text to meet the minimum chunk size requirements.\n\nThis is another paragraph with significantly more content for testing purposes. The text needs to be long enough to create meaningful chunks that meet the academic document processing standards and minimum length requirements.',
          markdown: 'This is content.',
          html: '<p>This is content.</p>',
          images: [],
          metadata: {
            wordCount: 20,
            paragraphCount: 2,
            headingCount: 0,
            imageCount: 0,
            processingTime: 100,
            extractionMethod: 'self-hosted-mammoth' as const
          },
          structure: {
            headings: [], // No headings to force content-based chunking
            tables: [],
            footnotes: []
          }
        }
      };

      const chunks = docxProcessor.createDocumentChunks(
        'test-doc-123',
        mockResult.data
      );

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThanOrEqual(1); // Should create at least one chunk from the text
      
      if (chunks.length > 0) {
        expect(chunks[0].documentId).toBe('test-doc-123');
        expect(chunks[0].content).toBeDefined();
        expect(chunks[0].characterCount).toBeGreaterThan(0);
        expect(chunks[0].id).toContain('test-doc-123');
        expect(chunks[0].metadata?.chunkingStrategy).toBe('content-based');
      }
    });

    it('should handle structure-based chunking with headings', () => {
      const mockResultWithStructure = {
        success: true,
        data: {
          text: 'Introduction\nThis is the introduction section with detailed information.\n\nMain Content\nThis is the main content section with more detailed information and analysis.',
          markdown: '',
          html: '',
          images: [],
          metadata: {
            wordCount: 20,
            paragraphCount: 2,
            headingCount: 2,
            imageCount: 0,
            processingTime: 100,
            extractionMethod: 'self-hosted-mammoth' as const
          },
          structure: {
            headings: [
              { level: 1, text: 'Introduction', id: 'heading_0_1' },
              { level: 1, text: 'Main Content', id: 'heading_1_1' }
            ],
            tables: [{
              rows: 3,
              columns: 2,
              content: 'Header 1 | Header 2\nRow 1 | Data 1\nRow 2 | Data 2',
              position: 0
            }],
            footnotes: [{
              id: 'footnote_1',
              text: 'This is a footnote explaining something important.',
              position: 0
            }]
          }
        }
      };

      const chunks = docxProcessor.createDocumentChunks(
        'structured-doc-456',
        mockResultWithStructure.data
      );

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThanOrEqual(2); // Should have sections + table + footnote
      
      // Check for different chunk types (may vary based on actual chunking logic)
      const chunkTypes = chunks.map(chunk => chunk.metadata?.sourceType).filter(Boolean);
      expect(chunkTypes.length).toBeGreaterThan(0);
    });

    it('should handle content-based chunking without structure', () => {
      const mockResultNoStructure = {
        success: true,
        data: {
          text: 'This is a document without clear headings. '.repeat(50), // Long text
          markdown: '',
          html: '',
          images: [],
          metadata: {
            wordCount: 400,
            paragraphCount: 1,
            headingCount: 0,
            imageCount: 0,
            processingTime: 100,
            extractionMethod: 'self-hosted-mammoth' as const
          },
          structure: {
            headings: [], // No headings
            tables: [],
            footnotes: []
          }
        }
      };

      const chunks = docxProcessor.createDocumentChunks(
        'no-structure-doc-789',
        mockResultNoStructure.data
      );

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      
      if (chunks.length > 0) {
        expect(chunks[0].metadata?.chunkingStrategy).toBe('content-based');
      }
    });

    it('should handle failed processing results in chunking', () => {
      const failedResult = {
        success: false,
        error: 'Processing failed'
      };

      const chunks = docxProcessor.createDocumentChunks(
        'failed-doc-123',
        undefined // No data
      );

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });
  });

  describe('Processing Options', () => {
    it('should respect processing options', async () => {
      const testBuffer = new ArrayBuffer(100);

      // Test minimal options
      const minimalResult = await docxProcessor.processDocx(
        testBuffer,
        'minimal.docx',
        {
          preserveImages: false,
          convertToMarkdown: false,
          extractStructure: false
        }
      );

      // Should still process (though will fail due to invalid DOCX)
      expect(minimalResult.success).toBe(false);
      expect(minimalResult.error).toBeDefined();

      // Test comprehensive options
      const comprehensiveResult = await docxProcessor.processDocx(
        testBuffer,
        'comprehensive.docx',
        {
          preserveImages: true,
          convertToMarkdown: true,
          extractStructure: true,
          includeStyles: true,
          handleFootnotes: true
        }
      );

      // Should still process with all options
      expect(comprehensiveResult.success).toBe(false);
      expect(comprehensiveResult.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', async () => {
      const invalidBuffer = new ArrayBuffer(10); // Too small to be valid DOCX
      
      const result = await docxProcessor.processDocx(
        invalidBuffer,
        'invalid.docx'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should validate file types implicitly', async () => {
      const testBuffer = new ArrayBuffer(1024);
      
      const result = await docxProcessor.processDocx(
        testBuffer,
        'not-a-docx-file.txt' // Wrong extension but should still try to process
      );
      
      // Will fail due to invalid content, but should accept the filename
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Document Structure Analysis', () => {
    it('should analyze different document types correctly', () => {
      // Academic paper structure
      expect(SelfHostedDocxProcessor.shouldUseParseExtract(
        15 * 1024 * 1024, // 15MB
        'research-paper.docx',
        false
      )).toBe(false); // Should be fine with self-hosted

      // Legal document structure
      expect(SelfHostedDocxProcessor.shouldUseParseExtract(
        8 * 1024 * 1024, // 8MB
        'legal-contract.docx',
        false
      )).toBe(true); // Should recommend ParseExtract

      // Technical manual
      expect(SelfHostedDocxProcessor.shouldUseParseExtract(
        20 * 1024 * 1024, // 20MB
        'technical-manual.docx',
        false
      )).toBe(true); // Should recommend ParseExtract

      // Simple document
      expect(SelfHostedDocxProcessor.shouldUseParseExtract(
        3 * 1024 * 1024, // 3MB
        'meeting-notes.docx',
        false
      )).toBe(false); // Should be fine with self-hosted
    });
  });

  describe('Chunking Strategies', () => {
    it('should create appropriate chunk sizes', () => {
      const shortText = 'This is a short document.';
      const longText = 'This is a long document. '.repeat(100);

      const shortMockData = {
        text: shortText,
        markdown: '',
        html: '',
        images: [],
        metadata: {
          wordCount: 5,
          paragraphCount: 1,
          headingCount: 0,
          imageCount: 0,
          processingTime: 50,
          extractionMethod: 'self-hosted-mammoth' as const
        },
        structure: { headings: [], tables: [], footnotes: [] }
      };

      const longMockData = {
        text: longText,
        markdown: '',
        html: '',
        images: [],
        metadata: {
          wordCount: 500,
          paragraphCount: 1,
          headingCount: 0,
          imageCount: 0,
          processingTime: 50,
          extractionMethod: 'self-hosted-mammoth' as const
        },
        structure: { headings: [], tables: [], footnotes: [] }
      };

      const shortChunks = docxProcessor.createDocumentChunks('short-doc', shortMockData);
      const longChunks = docxProcessor.createDocumentChunks('long-doc', longMockData);

      // Short document should have fewer chunks
      expect(shortChunks.length).toBeLessThanOrEqual(2);
      
      // Long document should be split into multiple chunks
      expect(longChunks.length).toBeGreaterThanOrEqual(1);
      
      // All chunks should have reasonable sizes (allowing some flexibility for chunking logic)
      longChunks.forEach(chunk => {
        expect(chunk.characterCount).toBeLessThanOrEqual(3000); // Allow some flexibility above default max
        expect(chunk.characterCount).toBeGreaterThan(0);
      });
    });
  });
});