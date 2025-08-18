/**
 * Unified Document Processing Service
 * 
 * Orchestrates document processing with hybrid approach:
 * - Direct processing for PDFs (Workers-compatible)
 * - Async processing for DOCX files (Node.js background service)
 * - Intelligent routing based on document characteristics
 */

import { HybridDocumentProcessor, ProcessingOptions, HybridProcessingResult } from './hybridDocumentProcessor';
import { AsyncDocumentProcessor, ProcessingJobStatus } from './asyncDocumentProcessor';
import { DocumentChunk } from '../types/document-processing';
import { ProcessingErrorMapper, DocumentProcessingError } from '../utils/processing-errors';

export interface UnifiedProcessingOptions extends ProcessingOptions {
  // Processing mode
  forceAsync?: boolean;
  forceDirect?: boolean;
  
  // Async-specific options
  priority?: 'low' | 'normal' | 'high';
  callbackUrl?: string;
  maxAsyncWaitTime?: number; // milliseconds
  
  // User context
  userId: string;
  courseId?: string;
}

export interface UnifiedProcessingResult {
  success: boolean;
  isAsync: boolean;
  data?: {
    // Direct processing result
    text?: string;
    pages?: number;
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
    
    // Async processing info
    jobId?: string;
    status?: ProcessingJobStatus;
    estimatedCompletion?: Date;
  };
  error?: string;
  recommendation?: string;
  chunks?: DocumentChunk[];
}

export class UnifiedDocumentProcessor {
  private hybridProcessor: HybridDocumentProcessor;
  public asyncProcessor: AsyncDocumentProcessor;

  constructor(
    parseExtractApiKey?: string,
    r2Storage?: any, // Cloudflare R2 binding
    database?: any   // D1 database binding
  ) {
    this.hybridProcessor = new HybridDocumentProcessor(parseExtractApiKey);
    this.asyncProcessor = new AsyncDocumentProcessor(r2Storage, database);
  }

  /**
   * Process document using optimal strategy (direct vs async)
   */
  async processDocument(
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string,
    options: UnifiedProcessingOptions
  ): Promise<UnifiedProcessingResult> {
    try {
      // Determine processing strategy
      const strategy = this.selectProcessingStrategy(
        fileBuffer.byteLength,
        fileType,
        fileName,
        options
      );

      console.log(`Processing ${fileName} using ${strategy} strategy`, {
        fileSize: `${Math.round(fileBuffer.byteLength / 1024)}KB`,
        fileType,
        userId: options.userId
      });

      if (strategy === 'async') {
        return await this.processAsync(fileBuffer, fileType, fileName, options);
      } else {
        return await this.processDirect(fileBuffer, fileType, fileName, options);
      }

    } catch (error) {
      console.error('Unified document processing failed:', error);
      
      return {
        success: false,
        isAsync: false,
        error: error instanceof Error ? error.message : 'Document processing failed'
      };
    }
  }

  /**
   * Check status of async processing job
   */
  async checkAsyncJobStatus(
    jobId: string,
    userId: string
  ): Promise<UnifiedProcessingResult> {
    try {
      const result = await this.asyncProcessor.getJobStatus(jobId, userId);
      
      if (!result.success) {
        return {
          success: false,
          isAsync: true,
          error: result.error || 'Failed to get job status'
        };
      }

      const chunks = result.data?.status === 'completed' && result.data.result
        ? await this.createUnifiedChunks('', result.data.result, { userId })
        : undefined;

      return {
        success: true,
        isAsync: true,
        data: {
          jobId,
          status: result.data?.status || 'unknown',
          ...(result.data?.result || {}),
          estimatedCompletion: result.data?.estimatedCompletion,
          metadata: {
            ...(result.data?.result?.metadata || {}),
            processingMode: 'async'
          }
        },
        chunks
      };

    } catch (error) {
      return {
        success: false,
        isAsync: true,
        error: error instanceof Error ? error.message : 'Failed to check job status'
      };
    }
  }

  /**
   * Get processing recommendation for a file
   */
  getProcessingRecommendation(
    fileSize: number,
    fileType: string,
    fileName: string
  ): {
    strategy: 'direct' | 'async';
    method: 'self-hosted' | 'parse-extract' | 'background-service';
    reasons: string[];
    estimatedTime: number; // seconds
    estimatedCost: number;
  } {
    const reasons: string[] = [];
    let strategy: 'direct' | 'async' = 'direct';
    let method: 'self-hosted' | 'parse-extract' | 'background-service' = 'self-hosted';
    let estimatedTime = 30;
    let estimatedCost = 0;

    // File type determines strategy
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // DOCX can now be processed directly using mammoth browser build
      strategy = 'direct';
      method = 'self-hosted';
      reasons.push('DOCX processing available using mammoth browser build');
      estimatedTime = fileSize > 10 * 1024 * 1024 ? 90 : 30; // 30-90 seconds
    } else if (fileType === 'application/pdf') {
      // PDF can use direct processing
      const pdfRecommendation = this.hybridProcessor.getProcessingRecommendation(
        fileSize,
        fileType,
        fileName
      );
      
      method = pdfRecommendation.recommendedMethod;
      estimatedTime = pdfRecommendation.estimatedTime;
      estimatedCost = pdfRecommendation.estimatedCost;
      reasons.push(...pdfRecommendation.reasons);
      
      // Force async for very large PDFs
      if (fileSize > 50 * 1024 * 1024) {
        strategy = 'async';
        method = 'background-service';
        reasons.push('Large PDF files processed asynchronously for better resource management');
        estimatedTime = 600; // 10 minutes
      }
    } else {
      // Unsupported file types require async processing
      strategy = 'async';
      method = 'background-service';
      reasons.push(`File type ${fileType} requires async processing with specialized tools`);
      estimatedTime = fileSize > 10 * 1024 * 1024 ? 300 : 120; // 2-5 minutes
    }

    return {
      strategy,
      method,
      reasons,
      estimatedTime,
      estimatedCost
    };
  }

  /**
   * Select optimal processing strategy
   */
  private selectProcessingStrategy(
    fileSize: number,
    fileType: string,
    fileName: string,
    options: UnifiedProcessingOptions
  ): 'direct' | 'async' {
    // Force specific strategy if requested
    if (options.forceAsync) return 'async';
    if (options.forceDirect) return 'direct';

    // DOCX files can now be processed directly using mammoth browser build
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'direct';
    }

    // PDF files can be processed directly
    if (fileType === 'application/pdf') {
      // Large PDFs benefit from async processing
      if (fileSize > 50 * 1024 * 1024) { // > 50MB
        return 'async';
      }
      return 'direct';
    }

    // Other file types require async processing
    return 'async';
  }

  /**
   * Process document directly (Workers environment)
   */
  private async processDirect(
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string,
    options: UnifiedProcessingOptions
  ): Promise<UnifiedProcessingResult> {
    try {
      const result = await this.hybridProcessor.processDocument(
        fileBuffer,
        fileType,
        fileName,
        options
      );

      // Create document chunks
      const chunks = result.success 
        ? this.hybridProcessor.createDocumentChunks('temp_doc_id', result, options)
        : [];

      return {
        success: result.success,
        isAsync: false,
        data: result.data ? {
          ...result.data,
          metadata: {
            ...result.data.metadata,
            processingMode: 'direct',
            userId: options.userId,
            courseId: options.courseId
          }
        } : undefined,
        error: result.error,
        recommendation: result.recommendation,
        chunks
      };

    } catch (error) {
      throw ProcessingErrorMapper.mapGenericError(error, fileName, fileType);
    }
  }

  /**
   * Process document asynchronously (background service)
   */
  private async processAsync(
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string,
    options: UnifiedProcessingOptions
  ): Promise<UnifiedProcessingResult> {
    try {
      const result = await this.asyncProcessor.submitProcessingJob(
        fileBuffer,
        fileType,
        fileName,
        {
          userId: options.userId,
          courseId: options.courseId,
          priority: options.priority || 'normal',
          callbackUrl: options.callbackUrl,
          processingOptions: {
            preserveFormatting: options.preserveFormatting,
            extractMetadata: options.extractMetadata,
            requireAdvancedFeatures: options.requireAdvancedFeatures
          }
        }
      );

      if (!result.success) {
        return {
          success: false,
          isAsync: true,
          error: result.error || 'Failed to submit async processing job'
        };
      }

      // Wait for completion if requested
      if (options.maxAsyncWaitTime && options.maxAsyncWaitTime > 0) {
        const completedResult = await this.waitForAsyncCompletion(
          result.data!.jobId,
          options.userId,
          options.maxAsyncWaitTime
        );
        
        if (completedResult) {
          return completedResult;
        }
      }

      return {
        success: true,
        isAsync: true,
        data: {
          jobId: result.data!.jobId,
          status: result.data!.status,
          estimatedCompletion: result.data!.estimatedCompletion,
          metadata: {
            processingMode: 'async',
            userId: options.userId,
            courseId: options.courseId,
            submittedAt: new Date().toISOString()
          }
        }
      };

    } catch (error) {
      throw ProcessingErrorMapper.mapGenericError(error, fileName, fileType);
    }
  }

  /**
   * Wait for async job completion (optional)
   */
  private async waitForAsyncCompletion(
    jobId: string,
    userId: string,
    maxWaitTime: number
  ): Promise<UnifiedProcessingResult | null> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < maxWaitTime) {
      await this.delay(pollInterval);

      const statusResult = await this.checkAsyncJobStatus(jobId, userId);
      
      if (statusResult.success && statusResult.data?.status === 'completed') {
        return statusResult;
      } else if (statusResult.data?.status === 'failed') {
        return {
          success: false,
          isAsync: true,
          error: 'Async processing failed'
        };
      }
    }

    return null; // Timeout
  }

  /**
   * Create unified document chunks from any processing result
   */
  private async createUnifiedChunks(
    documentId: string,
    result: any,
    options: UnifiedProcessingOptions
  ): Promise<DocumentChunk[]> {
    // This will be implemented based on the specific result format
    // For now, return empty array
    return [];
  }

  /**
   * Get processing statistics for monitoring
   */
  async getProcessingStats(userId: string): Promise<{
    directProcessing: {
      totalJobs: number;
      successRate: number;
      averageTime: number;
    };
    asyncProcessing: {
      totalJobs: number;
      queuedJobs: number;
      successRate: number;
      averageTime: number;
    };
  }> {
    // This would query the database for user-specific processing stats
    return {
      directProcessing: {
        totalJobs: 0,
        successRate: 0,
        averageTime: 0
      },
      asyncProcessing: {
        totalJobs: 0,
        queuedJobs: 0,
        successRate: 0,
        averageTime: 0
      }
    };
  }

  /**
   * Utility methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}