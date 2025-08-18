/**
 * Unified Document Processing Tests
 * 
 * Tests the complete unified processing system including:
 * - Direct processing for PDFs
 * - Async processing for DOCX files
 * - Processing strategy selection
 * - Job management and status checking
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedDocumentProcessor } from '../src/services/unifiedDocumentProcessor';
import { AsyncDocumentProcessor } from '../src/services/asyncDocumentProcessor';

// Mock PDF.js to avoid runtime issues in tests
vi.mock('pdfjs-dist', () => ({
  default: {
    getDocument: vi.fn().mockResolvedValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [{ str: 'Test PDF content' }]
          })
        })
      })
    }),
    GlobalWorkerOptions: {}
  }
}));

// Mock implementations
const mockR2Storage = {
  put: vi.fn().mockResolvedValue({}),
  get: vi.fn().mockResolvedValue({}),
  delete: vi.fn().mockResolvedValue({})
};

const mockDatabase = {
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue([])
    }))
  }))
};

// Test data
const testUserId = 'user_123';
const testCourseId = 'course_456';

const createTestPdfBuffer = () => {
  // Minimal PDF structure for testing
  const pdfHeader = '%PDF-1.4\n';
  return new TextEncoder().encode(pdfHeader);
};

const createTestDocxBuffer = () => {
  // Mock DOCX buffer (would be actual ZIP in real implementation)
  return new TextEncoder().encode('PK\x03\x04'); // ZIP signature
};

describe('UnifiedDocumentProcessor', () => {
  let processor: UnifiedDocumentProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new UnifiedDocumentProcessor(
      'test-api-key',
      mockR2Storage,
      mockDatabase
    );
  });

  describe('Processing Strategy Selection', () => {
    test('should recommend direct processing for small PDFs', () => {
      const recommendation = processor.getProcessingRecommendation(
        1024 * 1024, // 1MB
        'application/pdf',
        'simple-document.pdf'
      );

      expect(recommendation.strategy).toBe('direct');
      expect(recommendation.method).toBe('self-hosted');
      expect(recommendation.estimatedTime).toBeLessThan(60);
    });

    test('should recommend direct processing for DOCX files', () => {
      const recommendation = processor.getProcessingRecommendation(
        1024 * 1024, // 1MB
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'document.docx'
      );

      expect(recommendation.strategy).toBe('direct');
      expect(recommendation.method).toBe('self-hosted');
      expect(recommendation.reasons[0]).toContain('mammoth browser build');
    });

    test('should recommend async processing for large PDFs', () => {
      const recommendation = processor.getProcessingRecommendation(
        60 * 1024 * 1024, // 60MB
        'application/pdf',
        'large-document.pdf'
      );

      expect(recommendation.strategy).toBe('async');
      expect(recommendation.method).toBe('background-service');
      expect(recommendation.estimatedTime).toBeGreaterThan(300);
    });

    test('should recommend ParseExtract for complex PDFs', () => {
      const recommendation = processor.getProcessingRecommendation(
        5 * 1024 * 1024, // 5MB
        'application/pdf',
        'technical-report.pdf'
      );

      expect(recommendation.method).toBe('parse-extract');
      expect(recommendation.reasons[0]).toContain('complex layouts');
    });
  });

  describe('Direct PDF Processing', () => {
    test('should process small PDF directly', async () => {
      const fileBuffer = createTestPdfBuffer();
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/pdf',
        'test.pdf',
        {
          userId: testUserId,
          courseId: testCourseId,
          forceDirect: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.isAsync).toBe(false);
      expect(result.data?.metadata?.processingMode).toBe('direct');
      expect(result.chunks).toBeDefined();
    });

    test('should handle PDF processing errors gracefully', async () => {
      const invalidBuffer = new ArrayBuffer(0); // Empty buffer
      
      const result = await processor.processDocument(
        invalidBuffer,
        'application/pdf',
        'invalid.pdf',
        {
          userId: testUserId,
          forceDirect: true
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should preserve PDF processing options', async () => {
      const fileBuffer = createTestPdfBuffer();
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/pdf',
        'test.pdf',
        {
          userId: testUserId,
          preserveFormatting: true,
          extractMetadata: true,
          forceDirect: true
        }
      );

      expect(result.data?.metadata?.userId).toBe(testUserId);
      expect(result.data?.metadata?.processingMode).toBe('direct');
    });
  });

  describe('Direct DOCX Processing', () => {
    test('should process DOCX directly using mammoth browser build', async () => {
      const fileBuffer = createTestDocxBuffer();
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test.docx',
        {
          userId: testUserId,
          courseId: testCourseId
        }
      );

      expect(result.success).toBe(false); // Expected to fail with mock DOCX data
      expect(result.isAsync).toBe(false);
      expect(result.error).toContain('zip'); // Should get mammoth ZIP error, not Node.js error
      expect(result.error).not.toContain('node:os');
      expect(result.error).not.toContain('Node.js dependencies');
    });

    test('should handle DOCX processing options correctly', async () => {
      const fileBuffer = createTestDocxBuffer();
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'formatted.docx',
        {
          userId: testUserId,
          preserveFormatting: true,
          extractMetadata: true
        }
      );

      expect(result.success).toBe(false); // Expected to fail with mock data
      expect(result.isAsync).toBe(false);
      expect(result.error).toContain('zip'); // Mammoth ZIP error
      expect(result.error).not.toContain('Node.js dependencies');
    });

    test('should force async processing when requested', async () => {
      const fileBuffer = createTestDocxBuffer();
      
      // Mock successful database operations for async processing
      mockDatabase.prepare().bind().run.mockResolvedValue({ success: true });
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test.docx',
        {
          userId: testUserId,
          forceAsync: true // Force async even though DOCX can be processed directly
        }
      );

      expect(result.isAsync).toBe(true);
      // Should use async processing when forced
    });
  });

  describe('Job Status Management', () => {
    test('should check async job status', async () => {
      const jobId = 'test-job-123';
      const mockJob = {
        id: jobId,
        user_id: testUserId,
        status: 'processing',
        created_at: new Date().toISOString(),
        estimated_completion: new Date(Date.now() + 300000).toISOString() // 5 minutes
      };
      
      mockDatabase.prepare().bind().first.mockResolvedValue(mockJob);
      
      const result = await processor.checkAsyncJobStatus(jobId, testUserId);
      
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('processing');
      expect(result.isAsync).toBe(true);
    });

    test('should handle job not found', async () => {
      const jobId = 'nonexistent-job';
      
      mockDatabase.prepare().bind().first.mockResolvedValue(null);
      
      const result = await processor.checkAsyncJobStatus(jobId, testUserId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should return completed job with results', async () => {
      const jobId = 'completed-job-123';
      const mockCompletedJob = {
        id: jobId,
        user_id: testUserId,
        status: 'completed',
        result: JSON.stringify({
          text: 'Processed content',
          markdown: '# Processed content',
          metadata: { wordCount: 2, processingTime: 3000 }
        })
      };
      
      mockDatabase.prepare().bind().first.mockResolvedValue(mockCompletedJob);
      
      const result = await processor.checkAsyncJobStatus(jobId, testUserId);
      
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('completed');
      expect(result.data?.result).toBeDefined();
      expect(result.chunks).toBeDefined();
    });
  });

  describe('Processing Statistics', () => {
    test('should return processing statistics', async () => {
      // Mock database queries for statistics
      mockDatabase.prepare().bind().all.mockResolvedValue([]);
      
      const stats = await processor.getProcessingStats(testUserId);
      
      expect(stats).toHaveProperty('directProcessing');
      expect(stats).toHaveProperty('asyncProcessing');
      expect(stats.directProcessing).toHaveProperty('totalJobs');
      expect(stats.asyncProcessing).toHaveProperty('queuedJobs');
    });
  });

  describe('Error Handling', () => {
    test('should handle R2 storage errors', async () => {
      const fileBuffer = createTestDocxBuffer();
      
      // Mock R2 failure
      mockR2Storage.put.mockRejectedValue(new Error('R2 storage unavailable'));
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test.docx',
        { userId: testUserId }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('storage');
    });

    test('should handle database errors', async () => {
      const fileBuffer = createTestDocxBuffer();
      
      // Mock database failure
      mockDatabase.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test.docx',
        { userId: testUserId }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database');
    });

    test('should validate required user ID', async () => {
      const fileBuffer = createTestPdfBuffer();
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/pdf',
        'test.pdf',
        {} as any // Missing userId
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('User ID');
    });

    test('should handle file size limits', async () => {
      const largeBuffer = new ArrayBuffer(150 * 1024 * 1024); // 150MB
      
      const result = await processor.processDocument(
        largeBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'huge.docx',
        { userId: testUserId }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
    });
  });

  describe('Force Processing Modes', () => {
    test('should force async processing when requested', async () => {
      const fileBuffer = createTestPdfBuffer();
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/pdf',
        'test.pdf',
        {
          userId: testUserId,
          forceAsync: true
        }
      );

      expect(result.isAsync).toBe(true);
    });

    test('should force direct processing when possible', async () => {
      const fileBuffer = createTestPdfBuffer();
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/pdf',
        'test.pdf',
        {
          userId: testUserId,
          forceDirect: true
        }
      );

      expect(result.isAsync).toBe(false);
    });

    test('should process DOCX directly when force direct is requested', async () => {
      const fileBuffer = createTestDocxBuffer();
      
      const result = await processor.processDocument(
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test.docx',
        {
          userId: testUserId,
          forceDirect: true // DOCX can now be processed directly
        }
      );

      expect(result.isAsync).toBe(false); // Should be direct processing now
      expect(result.error).toContain('zip'); // Should get mammoth processing error
    });
  });
});

describe('AsyncDocumentProcessor', () => {
  let asyncProcessor: AsyncDocumentProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    asyncProcessor = new AsyncDocumentProcessor(mockR2Storage, mockDatabase);
  });

  describe('Job Submission', () => {
    test('should generate unique job IDs', async () => {
      const fileBuffer = createTestDocxBuffer();
      
      const result1 = await asyncProcessor.submitProcessingJob(
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test1.docx',
        { userId: testUserId }
      );
      
      const result2 = await asyncProcessor.submitProcessingJob(
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'test2.docx',
        { userId: testUserId }
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.jobId).not.toBe(result2.data?.jobId);
    });

    test('should generate proper R2 keys', () => {
      // Test the key generation pattern
      const mockAsyncProcessor = new AsyncDocumentProcessor(mockR2Storage, mockDatabase);
      
      const key = mockAsyncProcessor.generateR2Key('user123', 'job456', 'test file.docx');
      
      expect(key).toMatch(/^async-processing\/user123\/\d{4}-\d{2}-\d{2}\/job456\/test_file\.docx$/);
    });
  });

  describe('Job Cancellation', () => {
    test('should cancel queued jobs', async () => {
      const jobId = 'test-job-123';
      const mockJob = {
        id: jobId,
        user_id: testUserId,
        status: 'queued',
        r2_key: 'test/path/file.docx'
      };
      
      mockDatabase.prepare().bind().first.mockResolvedValue(mockJob);
      
      const result = await asyncProcessor.cancelJob(jobId, testUserId);
      
      expect(result.success).toBe(true);
      expect(mockR2Storage.delete).toHaveBeenCalledWith('test/path/file.docx');
    });

    test('should not cancel processing jobs', async () => {
      const jobId = 'test-job-123';
      const mockJob = {
        id: jobId,
        user_id: testUserId,
        status: 'processing'
      };
      
      mockDatabase.prepare().bind().first.mockResolvedValue(mockJob);
      
      const result = await asyncProcessor.cancelJob(jobId, testUserId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot cancel job that is already processing');
    });
  });
});