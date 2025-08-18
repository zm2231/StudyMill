import { describe, it, expect } from 'vitest';
import { configurePdfJs, PDF_CONFIG } from '../src/config/pdfjs-config';
import { MAMMOTH_CONFIG, cleanMammothHtml } from '../src/config/mammoth-config';
import { CHEERIO_CONFIG, TURNDOWN_CONFIG, createTurndownService, HtmlCleaner } from '../src/config/html-config';
import { DocumentProcessingError, ProcessingErrorMapper, FileValidator } from '../src/utils/processing-errors';

describe('Document Processing Libraries Compatibility', () => {
  describe('PDF.js Configuration', () => {
    it('should have proper PDF configuration', () => {
      // Verify configuration without actually importing pdfjs-dist
      expect(PDF_CONFIG).toBeDefined();
      expect(PDF_CONFIG.maxFileSize).toBe(50 * 1024 * 1024);
      expect(PDF_CONFIG.maxPages).toBe(500);
      expect(PDF_CONFIG.textOptions).toBeDefined();
      expect(PDF_CONFIG.loadOptions).toBeDefined();
    });

    it('should handle PDF processing errors', () => {
      const testError = ProcessingErrorMapper.mapPdfError(
        new Error('Test PDF error'),
        'test.pdf'
      );
      
      expect(testError).toBeInstanceOf(DocumentProcessingError);
      expect(testError.fileName).toBe('test.pdf');
      expect(testError.fileType).toBe('application/pdf');
    });

    it('should validate PDF file constraints', () => {
      // Test file size validation
      expect(() => {
        FileValidator.validateFileSize(100 * 1024 * 1024, PDF_CONFIG.maxFileSize);
      }).toThrow();

      // Test valid file size
      expect(() => {
        FileValidator.validateFileSize(10 * 1024 * 1024, PDF_CONFIG.maxFileSize);
      }).not.toThrow();
    });
  });

  describe('Mammoth DOCX Configuration', () => {
    it('should have proper mammoth configuration', () => {
      expect(MAMMOTH_CONFIG).toBeDefined();
      expect(MAMMOTH_CONFIG.maxFileSize).toBe(100 * 1024 * 1024);
      expect(Array.isArray(MAMMOTH_CONFIG.styleMap)).toBe(true);
      expect(MAMMOTH_CONFIG.styleMap.length).toBeGreaterThan(0);
    });

    it('should clean mammoth HTML output', () => {
      const dirtyHtml = '<p></p><p>   Test content   </p><p></p>';
      const cleaned = cleanMammothHtml(dirtyHtml);
      
      expect(cleaned).toBe('<p> Test content </p>');
      expect(cleaned).not.toContain('<p></p>');
    });

    it('should handle DOCX processing errors', () => {
      const testError = ProcessingErrorMapper.mapDocxError(
        new Error('Test DOCX error'),
        'test.docx'
      );
      
      expect(testError).toBeInstanceOf(DocumentProcessingError);
      expect(testError.fileName).toBe('test.docx');
      expect(testError.fileType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should validate DOCX file constraints', () => {
      expect(() => {
        FileValidator.validateFileSize(200 * 1024 * 1024, MAMMOTH_CONFIG.maxFileSize);
      }).toThrow();

      expect(() => {
        FileValidator.validateFileSize(50 * 1024 * 1024, MAMMOTH_CONFIG.maxFileSize);
      }).not.toThrow();
    });
  });

  describe('Cheerio and Turndown Configuration', () => {
    it('should have proper HTML processing configuration', () => {
      expect(CHEERIO_CONFIG).toBeDefined();
      expect(CHEERIO_CONFIG.contentSelectors).toBeDefined();
      expect(Array.isArray(CHEERIO_CONFIG.contentSelectors.main)).toBe(true);
      expect(Array.isArray(CHEERIO_CONFIG.contentSelectors.remove)).toBe(true);
    });

    it('should have proper turndown configuration', () => {
      expect(TURNDOWN_CONFIG).toBeDefined();
      expect(TURNDOWN_CONFIG.headingStyle).toBe('atx');
      expect(TURNDOWN_CONFIG.bulletListMarker).toBe('-');
      expect(TURNDOWN_CONFIG.codeBlockStyle).toBe('fenced');
    });

    it('should create HTML cleaner instance', () => {
      const testHtml = '<html><body><p>Test</p></body></html>';
      const cleaner = new HtmlCleaner(testHtml);
      
      expect(cleaner).toBeDefined();
      expect(typeof cleaner.extractMainContent).toBe('function');
      expect(typeof cleaner.extractMetadata).toBe('function');
    });

    it('should handle HTML processing errors', () => {
      const testError = ProcessingErrorMapper.mapHtmlError(
        new Error('Test HTML error'),
        'test.html'
      );
      
      expect(testError).toBeInstanceOf(DocumentProcessingError);
      expect(testError.fileName).toBe('test.html');
      expect(testError.fileType).toBe('text/html');
    });
  });

  describe('Error Handling System', () => {
    it('should create proper error responses', () => {
      const error = new DocumentProcessingError(
        'FILE_TOO_LARGE' as any,
        'Test error message',
        {
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          stage: 'validation',
          recoverable: true
        }
      );
      
      expect(error.type).toBe('FILE_TOO_LARGE');
      expect(error.fileName).toBe('test.pdf');
      expect(error.fileType).toBe('application/pdf');
      expect(error.recoverable).toBe(true);
      expect(error.userMessage).toBeDefined();
    });

    it('should validate file names properly', () => {
      // Valid file names
      expect(() => {
        FileValidator.validateFileName('document.pdf');
      }).not.toThrow();

      expect(() => {
        FileValidator.validateFileName('my-file_name.docx');
      }).not.toThrow();

      // Invalid file names
      expect(() => {
        FileValidator.validateFileName('');
      }).toThrow();

      expect(() => {
        FileValidator.validateFileName('../dangerous.pdf');
      }).toThrow();

      expect(() => {
        FileValidator.validateFileName('file<script>.pdf');
      }).toThrow();
    });

    it('should validate file types properly', () => {
      const supportedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/html'
      ];

      // Valid file types
      expect(() => {
        FileValidator.validateFileType('application/pdf', supportedTypes);
      }).not.toThrow();

      // Invalid file types
      expect(() => {
        FileValidator.validateFileType('application/msword', supportedTypes);
      }).toThrow();

      expect(() => {
        FileValidator.validateFileType('image/jpeg', supportedTypes);
      }).toThrow();
    });
  });

  describe('Workers Runtime Compatibility', () => {
    it('should not use Node.js specific APIs', () => {
      // Verify that our configurations don't rely on Node.js APIs
      expect(() => {
        configurePdfJs();
      }).not.toThrow();

      expect(() => {
        createTurndownService();
      }).not.toThrow();

      // Test that global objects don't include Node.js specific items
      expect(typeof window).toBe('undefined'); // Workers don't have window
      // Note: global may exist in test environment but shouldn't be used in actual Workers
      // Workers runtime will have different global object structure
    });

    it('should handle memory constraints properly', () => {
      // Test that our error handling recognizes memory issues
      const memoryError = new Error('out of memory');
      const mappedError = ProcessingErrorMapper.mapGenericError(
        memoryError,
        'large-file.pdf'
      );
      
      expect(mappedError.type).toBe('MEMORY_LIMIT_EXCEEDED');
    });

    it('should have proper timeout handling', () => {
      const timeoutError = new Error('operation timed out');
      const mappedError = ProcessingErrorMapper.mapGenericError(
        timeoutError,
        'slow-file.pdf'
      );
      
      expect(mappedError.type).toBe('PROCESSING_TIMEOUT');
    });
  });

  describe('Configuration Validation', () => {
    it('should have reasonable file size limits', () => {
      // PDF limit should be reasonable for academic documents
      expect(PDF_CONFIG.maxFileSize).toBeLessThanOrEqual(100 * 1024 * 1024);
      expect(PDF_CONFIG.maxFileSize).toBeGreaterThanOrEqual(10 * 1024 * 1024);

      // DOCX limit should be larger than PDF (less complex processing)
      expect(MAMMOTH_CONFIG.maxFileSize).toBeGreaterThanOrEqual(PDF_CONFIG.maxFileSize);
    });

    it('should have proper chunking configuration', async () => {
      // Import chunking config from types
      const { DEFAULT_CHUNKING_CONFIG } = await import('../src/types/document-processing');
      
      expect(DEFAULT_CHUNKING_CONFIG.academic).toBeDefined();
      expect(DEFAULT_CHUNKING_CONFIG.academic.maxChunkSize).toBeLessThanOrEqual(2000);
      expect(DEFAULT_CHUNKING_CONFIG.academic.overlapSize).toBeGreaterThan(0);
      expect(DEFAULT_CHUNKING_CONFIG.academic.minChunkSize).toBeGreaterThan(0);
    });

    it('should support all required file types', async () => {
      const { SUPPORTED_FILE_TYPES } = await import('../src/types/document-processing');
      
      expect(SUPPORTED_FILE_TYPES['application/pdf']).toBeDefined();
      expect(SUPPORTED_FILE_TYPES['application/vnd.openxmlformats-officedocument.wordprocessingml.document']).toBeDefined();
      expect(SUPPORTED_FILE_TYPES['text/html']).toBeDefined();
      expect(SUPPORTED_FILE_TYPES['text/plain']).toBeDefined();
    });
  });
});