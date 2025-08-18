import { describe, it, expect, beforeAll } from 'vitest';
import { SelfHostedPdfProcessor } from '../src/services/selfHostedPdfProcessor';
import { HybridDocumentProcessor } from '../src/services/hybridDocumentProcessor';

describe('PDF Processing Service', () => {
  let selfHostedProcessor: SelfHostedPdfProcessor;
  let hybridProcessor: HybridDocumentProcessor;

  beforeAll(() => {
    selfHostedProcessor = new SelfHostedPdfProcessor();
    hybridProcessor = new HybridDocumentProcessor(); // No ParseExtract API for tests
  });

  describe('SelfHostedPdfProcessor', () => {
    it('should initialize without errors', () => {
      expect(selfHostedProcessor).toBeDefined();
      expect(typeof selfHostedProcessor.processPdf).toBe('function');
      expect(typeof selfHostedProcessor.createDocumentChunks).toBe('function');
    });

    it('should validate file size limits', async () => {
      const tooLargeBuffer = new ArrayBuffer(100 * 1024 * 1024); // 100MB
      
      const result = await selfHostedProcessor.processPdf(
        tooLargeBuffer,
        'large-document.pdf'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });

    it('should validate file names', async () => {
      const validBuffer = new ArrayBuffer(1024); // 1KB
      
      const result = await selfHostedProcessor.processPdf(
        validBuffer,
        '../dangerous-file.pdf'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid characters');
    });

    it('should handle empty or invalid PDF buffers', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      
      const result = await selfHostedProcessor.processPdf(
        emptyBuffer,
        'empty.pdf'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should have static method for ParseExtract recommendation', () => {
      // Small, simple document should not need ParseExtract
      expect(SelfHostedPdfProcessor.shouldUseParseExtract(
        1024 * 1024, // 1MB
        'simple-document.pdf',
        false
      )).toBe(false);

      // Large document should recommend ParseExtract
      expect(SelfHostedPdfProcessor.shouldUseParseExtract(
        25 * 1024 * 1024, // 25MB
        'large-document.pdf',
        false
      )).toBe(true);

      // Financial document should recommend ParseExtract
      expect(SelfHostedPdfProcessor.shouldUseParseExtract(
        5 * 1024 * 1024, // 5MB
        'financial-report.pdf',
        false
      )).toBe(true);

      // Advanced features explicitly requested
      expect(SelfHostedPdfProcessor.shouldUseParseExtract(
        1024 * 1024, // 1MB
        'simple.pdf',
        true // requireAdvancedFeatures
      )).toBe(true);
    });
  });

  describe('HybridDocumentProcessor', () => {
    it('should initialize without errors', () => {
      expect(hybridProcessor).toBeDefined();
      expect(typeof hybridProcessor.processDocument).toBe('function');
      expect(typeof hybridProcessor.createDocumentChunks).toBe('function');
      expect(typeof hybridProcessor.getProcessingRecommendation).toBe('function');
    });

    it('should provide processing recommendations', () => {
      // PDF document recommendation
      const pdfRec = hybridProcessor.getProcessingRecommendation(
        2 * 1024 * 1024, // 2MB
        'application/pdf',
        'research-paper.pdf'
      );
      
      expect(pdfRec.recommendedMethod).toBe('self-hosted');
      expect(pdfRec.estimatedCost).toBe(0);
      expect(pdfRec.estimatedTime).toBeGreaterThan(0);
      expect(Array.isArray(pdfRec.reasons)).toBe(true);

      // DOCX document recommendation
      const docxRec = hybridProcessor.getProcessingRecommendation(
        1 * 1024 * 1024, // 1MB
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'document.docx'
      );
      
      expect(docxRec.recommendedMethod).toBe('parse-extract');
      expect(docxRec.estimatedCost).toBeGreaterThan(0);
      expect(docxRec.reasons).toContain('File type application/vnd.openxmlformats-officedocument.wordprocessingml.document requires ParseExtract API');

      // Large PDF recommendation
      const largePdfRec = hybridProcessor.getProcessingRecommendation(
        25 * 1024 * 1024, // 25MB
        'application/pdf',
        'large-manual.pdf'
      );
      
      expect(largePdfRec.recommendedMethod).toBe('parse-extract');
      expect(largePdfRec.estimatedCost).toBeGreaterThan(0);
      expect(largePdfRec.reasons).toContain('Large file size optimized for ParseExtract');
    });

    it('should handle processing options correctly', async () => {
      const testBuffer = new ArrayBuffer(1024);
      
      // Test with prefer self-hosted
      const result1 = await hybridProcessor.processDocument(
        testBuffer,
        'application/pdf',
        'test.pdf',
        { preferSelfHosted: true }
      );
      
      // Should attempt self-hosted even if it fails (no valid PDF data)
      expect(result1.method).toBe('self-hosted');

      // Test with require advanced features (no ParseExtract available)
      const result2 = await hybridProcessor.processDocument(
        testBuffer,
        'application/pdf',
        'test.pdf',
        { requireAdvancedFeatures: true }
      );
      
      // Should still use self-hosted since ParseExtract not configured
      expect(result2.method).toBe('self-hosted');
    });

    it('should handle non-PDF files gracefully', async () => {
      const testBuffer = new ArrayBuffer(1024);
      
      const result = await hybridProcessor.processDocument(
        testBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test.docx'
      );
      
      expect(result.success).toBe(false);
      expect(result.method).toBe('fallback');
      expect(result.error).toContain('requires ParseExtract API');
      expect(result.recommendation).toContain('Configure ParseExtract API');
    });

    it('should create document chunks from processing results', () => {
      // Test with ParseExtract-style result (should use fallback chunking)
      const mockParseExtractResult = {
        success: true,
        method: 'parse-extract' as const,
        data: {
          text: 'This is a test document. It has multiple sentences. This should create chunks properly for testing purposes.',
          pages: 1,
          metadata: {},
          processingTime: 100
        }
      };

      const chunks = hybridProcessor.createDocumentChunks(
        'test-doc-123',
        mockParseExtractResult
      );

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      
      if (chunks.length > 0) {
        expect(chunks[0].documentId).toBe('test-doc-123');
        expect(chunks[0].content).toBeDefined();
        expect(chunks[0].contentType).toBe('text');
        expect(chunks[0].characterCount).toBeGreaterThan(0);
        expect(chunks[0].id).toContain('test-doc-123');
      }
    });

    it('should handle failed processing results in chunking', () => {
      const failedResult = {
        success: false,
        method: 'self-hosted' as const,
        error: 'Processing failed'
      };

      const chunks = hybridProcessor.createDocumentChunks(
        'failed-doc-123',
        failedResult
      );

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });
  });

  describe('Processing Method Selection', () => {
    it('should select appropriate processing methods', () => {
      // Small PDF should prefer self-hosted
      const rec1 = hybridProcessor.getProcessingRecommendation(
        1024 * 1024, // 1MB
        'application/pdf',
        'simple.pdf'
      );
      expect(rec1.recommendedMethod).toBe('self-hosted');

      // Large PDF should prefer ParseExtract
      const rec2 = hybridProcessor.getProcessingRecommendation(
        30 * 1024 * 1024, // 30MB
        'application/pdf',
        'large.pdf'
      );
      expect(rec2.recommendedMethod).toBe('parse-extract');

      // Complex document types
      const rec3 = hybridProcessor.getProcessingRecommendation(
        5 * 1024 * 1024, // 5MB
        'application/pdf',
        'financial-statement.pdf'
      );
      expect(rec3.recommendedMethod).toBe('parse-extract');

      // Non-PDF files
      const rec4 = hybridProcessor.getProcessingRecommendation(
        2 * 1024 * 1024, // 2MB
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'document.docx'
      );
      expect(rec4.recommendedMethod).toBe('parse-extract');
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', async () => {
      const invalidBuffer = new ArrayBuffer(10); // Too small to be valid PDF
      
      const result = await hybridProcessor.processDocument(
        invalidBuffer,
        'application/pdf',
        'invalid.pdf'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should validate processing options', async () => {
      const testBuffer = new ArrayBuffer(1024);
      
      // Test with very restrictive cost limit
      const result = await hybridProcessor.processDocument(
        testBuffer,
        'application/pdf',
        'test.pdf',
        { maxCostPerDocument: 0.01 }
      );
      
      // Should prefer self-hosted due to cost constraint
      expect(result.method).toBe('self-hosted');
    });
  });

  describe('Performance and Configuration', () => {
    it('should have reasonable performance expectations', () => {
      // Small files should process quickly
      const smallRec = hybridProcessor.getProcessingRecommendation(
        100 * 1024, // 100KB
        'application/pdf',
        'small.pdf'
      );
      expect(smallRec.estimatedTime).toBeLessThan(30);

      // Large files should have longer estimates
      const largeRec = hybridProcessor.getProcessingRecommendation(
        50 * 1024 * 1024, // 50MB
        'application/pdf',
        'large.pdf'
      );
      expect(largeRec.estimatedTime).toBeGreaterThan(60);
    });

    it('should provide cost estimates', () => {
      const rec = hybridProcessor.getProcessingRecommendation(
        10 * 1024 * 1024, // 10MB
        'application/pdf',
        'medium.pdf'
      );

      if (rec.recommendedMethod === 'parse-extract') {
        expect(rec.estimatedCost).toBeGreaterThan(0);
      } else {
        expect(rec.estimatedCost).toBe(0);
      }
    });
  });
});