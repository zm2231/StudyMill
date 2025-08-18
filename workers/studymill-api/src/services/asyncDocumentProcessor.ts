/**
 * Async Document Processing Service
 * 
 * Handles file uploads to R2 storage and manages processing jobs
 * for documents that require Node.js dependencies (DOCX, complex PDFs)
 */

import { ProcessingErrorMapper, DocumentProcessingError, UnifiedProcessingError } from '../utils/processing-errors';

export type ProcessingJobStatus = 
  | 'queued' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'timeout' 
  | 'cancelled';

export interface ProcessingJob {
  id: string;
  userId: string;
  courseId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  r2Key: string;
  status: ProcessingJobStatus;
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
  callbackUrl?: string;
  processingOptions: {
    preserveFormatting?: boolean;
    extractMetadata?: boolean;
    requireAdvancedFeatures?: boolean;
  };
  result?: {
    text: string;
    markdown?: string;
    metadata: Record<string, any>;
    processingTime: number;
    chunks?: any[];
  };
  error?: string;
}

export interface AsyncProcessingOptions {
  userId: string;
  courseId?: string;
  priority?: 'low' | 'normal' | 'high';
  callbackUrl?: string;
  processingOptions?: {
    preserveFormatting?: boolean;
    extractMetadata?: boolean;
    requireAdvancedFeatures?: boolean;
  };
}

export interface AsyncProcessingResult {
  success: boolean;
  data?: {
    jobId: string;
    status: ProcessingJobStatus;
    estimatedCompletion: Date;
  };
  error?: string;
}

export interface JobStatusResult {
  success: boolean;
  data?: {
    status: ProcessingJobStatus;
    result?: ProcessingJob['result'];
    estimatedCompletion?: Date;
    error?: string;
  };
  error?: string;
}

export class AsyncDocumentProcessor {
  private r2Storage: any; // Cloudflare R2 binding
  private database: any;  // D1 database binding
  private readonly R2_BUCKET = 'studymill-documents';
  
  constructor(r2Storage?: any, database?: any) {
    this.r2Storage = r2Storage;
    this.database = database;
  }

  /**
   * Submit document for async processing
   */
  async submitProcessingJob(
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string,
    options: AsyncProcessingOptions
  ): Promise<AsyncProcessingResult> {
    const startTime = Date.now();

    try {
      // Validate inputs
      this.validateAsyncProcessing(fileBuffer, fileType, fileName, options);

      // Generate job ID and R2 key
      const jobId = this.generateJobId();
      const r2Key = this.generateR2Key(options.userId, jobId, fileName);

      console.log(`Submitting async processing job ${jobId}`, {
        fileName,
        fileType,
        fileSize: fileBuffer.byteLength,
        userId: options.userId,
        priority: options.priority || 'normal'
      });

      // Upload file to R2 storage
      await this.uploadToR2(r2Key, fileBuffer, fileType, fileName);

      // Calculate estimated completion time
      const estimatedCompletion = this.calculateEstimatedCompletion(
        fileBuffer.byteLength,
        fileType,
        options.priority || 'normal'
      );

      // Create processing job record
      const job: ProcessingJob = {
        id: jobId,
        userId: options.userId,
        courseId: options.courseId,
        fileName,
        fileType,
        fileSize: fileBuffer.byteLength,
        r2Key,
        status: 'queued',
        priority: options.priority || 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedCompletion,
        callbackUrl: options.callbackUrl,
        processingOptions: options.processingOptions || {}
      };

      // Store job in database
      await this.storeProcessingJob(job);

      // Notify background service (webhook or queue)
      await this.notifyBackgroundService(job);

      const processingTime = Date.now() - startTime;
      console.log(`Async job ${jobId} submitted successfully in ${processingTime}ms`);

      return {
        success: true,
        data: {
          jobId,
          status: 'queued',
          estimatedCompletion
        }
      };

    } catch (error) {
      console.error('Failed to submit async processing job:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit processing job'
      };
    }
  }

  /**
   * Get status of processing job
   */
  async getJobStatus(jobId: string, userId: string): Promise<JobStatusResult> {
    try {
      // Verify user owns this job
      const job = await this.getJobFromDatabase(jobId, userId);
      
      if (!job) {
        return {
          success: false,
          error: 'Job not found or access denied'
        };
      }

      return {
        success: true,
        data: {
          status: job.status,
          result: job.result,
          estimatedCompletion: job.estimatedCompletion,
          error: job.error
        }
      };

    } catch (error) {
      console.error(`Failed to get job status for ${jobId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get job status'
      };
    }
  }

  /**
   * Cancel processing job (if not started yet)
   */
  async cancelJob(jobId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const job = await this.getJobFromDatabase(jobId, userId);
      
      if (!job) {
        return {
          success: false,
          error: 'Job not found or access denied'
        };
      }

      if (job.status === 'processing') {
        return {
          success: false,
          error: 'Cannot cancel job that is already processing'
        };
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return {
          success: false,
          error: 'Cannot cancel completed job'
        };
      }

      // Update job status
      await this.updateJobStatus(jobId, 'cancelled');
      
      // Clean up R2 file
      await this.cleanupR2File(job.r2Key);

      return { success: true };

    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel job'
      };
    }
  }

  /**
   * Get user's processing jobs with pagination
   */
  async getUserJobs(
    userId: string,
    options: {
      status?: ProcessingJobStatus;
      limit?: number;
      offset?: number;
      courseId?: string;
    } = {}
  ): Promise<{
    success: boolean;
    data?: {
      jobs: ProcessingJob[];
      total: number;
      hasMore: boolean;
    };
    error?: string;
  }> {
    try {
      const limit = Math.min(options.limit || 20, 100);
      const offset = options.offset || 0;
      
      // Build query conditions
      const conditions: string[] = ['d.user_id = ?'];
      const params: any[] = [userId];
      
      if (options.status) {
        conditions.push('d.processing_status = ?');
        params.push(options.status);
      }
      
      if (options.courseId) {
        conditions.push('d.course_id = ?');
        params.push(options.courseId);
      }
      
      const whereClause = conditions.join(' AND ');
      
      // Get total count
      const countResult = await this.dbService.db.prepare(`
        SELECT COUNT(*) as total
        FROM documents d
        WHERE ${whereClause}
      `).bind(...params).first();
      
      const total = (countResult as any)?.total || 0;
      
      // Get jobs with pagination
      const jobsResult = await this.dbService.db.prepare(`
        SELECT 
          d.id,
          d.user_id,
          d.course_id,
          d.file_name,
          d.file_type,
          d.file_size,
          d.storage_key as r2_key,
          d.processing_status,
          d.processing_error,
          d.created_at,
          d.updated_at,
          c.name as course_name
        FROM documents d
        LEFT JOIN courses c ON d.course_id = c.id
        WHERE ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all();
      
      // Transform database results to ProcessingJob format
      const jobs: ProcessingJob[] = (jobsResult.results as any[]).map(row => ({
        id: row.id,
        userId: row.user_id,
        courseId: row.course_id,
        fileName: row.file_name,
        fileType: row.file_type,
        fileSize: row.file_size,
        r2Key: row.r2_key,
        status: row.processing_status as ProcessingJobStatus,
        priority: 'normal' as const, // Default priority
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        processingOptions: {
          preserveFormatting: true,
          extractMetadata: true,
          requireAdvancedFeatures: false
        },
        error: row.processing_error || undefined,
        // Add course name to metadata if available
        courseName: row.course_name
      }));
      
      return {
        success: true,
        data: {
          jobs,
          total,
          hasMore: total > offset + limit
        }
      };

    } catch (error) {
      console.error(`Failed to get jobs for user ${userId}:`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user jobs'
      };
    }
  }

  /**
   * Private helper methods
   */

  private validateAsyncProcessing(
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string,
    options: AsyncProcessingOptions
  ): void {
    if (!this.r2Storage) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.EXTERNAL_SERVICE_ERROR,
        'R2 storage not configured for async processing'
      );
    }

    if (!this.database) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.EXTERNAL_SERVICE_ERROR,
        'Database not configured for async processing'
      );
    }

    if (!options.userId) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.INVALID_FILE_FORMAT,
        'User ID required for async processing'
      );
    }

    // File size validation (100MB limit for async)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (fileBuffer.byteLength > maxSize) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.FILE_TOO_LARGE,
        `File too large for async processing. Maximum size: ${maxSize / 1024 / 1024}MB`
      );
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public generateR2Key(userId: string, jobId: string, fileName: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `async-processing/${userId}/${timestamp}/${jobId}/${sanitizedFileName}`;
  }

  private async uploadToR2(
    key: string,
    fileBuffer: ArrayBuffer,
    fileType: string,
    fileName: string
  ): Promise<void> {
    try {
      await this.r2Storage.put(key, fileBuffer, {
        httpMetadata: {
          contentType: fileType,
          contentDisposition: `attachment; filename="${fileName}"`
        },
        customMetadata: {
          originalFileName: fileName,
          uploadedAt: new Date().toISOString()
        }
      });

      console.log(`File uploaded to R2: ${key}`);
    } catch (error) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.EXTERNAL_SERVICE_ERROR,
        `Failed to upload file to R2: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private calculateEstimatedCompletion(
    fileSize: number,
    fileType: string,
    priority: 'low' | 'normal' | 'high'
  ): Date {
    // Base processing time estimate
    let estimatedMinutes = 2; // Base 2 minutes
    
    // File size factor
    const sizeMB = fileSize / (1024 * 1024);
    estimatedMinutes += sizeMB * 0.5; // 30 seconds per MB
    
    // File type factor
    if (fileType.includes('word') || fileType.includes('docx')) {
      estimatedMinutes += 3; // DOCX processing overhead
    }
    
    // Priority factor
    const priorityMultiplier = {
      'high': 1.0,
      'normal': 1.5,
      'low': 2.0
    };
    
    estimatedMinutes *= priorityMultiplier[priority];
    
    // Add queue wait time (assume 5-15 minutes based on priority)
    const queueWaitMinutes = {
      'high': 5,
      'normal': 10,
      'low': 15
    };
    
    estimatedMinutes += queueWaitMinutes[priority];
    
    const completion = new Date();
    completion.setMinutes(completion.getMinutes() + Math.ceil(estimatedMinutes));
    
    return completion;
  }

  private async storeProcessingJob(job: ProcessingJob): Promise<void> {
    try {
      // Store in D1 database
      // This would use your actual database schema
      const sql = `
        INSERT INTO processing_jobs (
          id, user_id, course_id, file_name, file_type, file_size,
          r2_key, status, priority, created_at, estimated_completion,
          callback_url, processing_options
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.database.prepare(sql).bind(
        job.id,
        job.userId,
        job.courseId || null,
        job.fileName,
        job.fileType,
        job.fileSize,
        job.r2Key,
        job.status,
        job.priority,
        job.createdAt.toISOString(),
        job.estimatedCompletion?.toISOString() || null,
        job.callbackUrl || null,
        JSON.stringify(job.processingOptions)
      ).run();

    } catch (error) {
      throw new DocumentProcessingError(
        UnifiedProcessingError.EXTERNAL_SERVICE_ERROR,
        `Failed to store processing job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async notifyBackgroundService(job: ProcessingJob): Promise<void> {
    try {
      // This would notify your background processing service
      // Could be a webhook, queue message, or database trigger
      
      console.log(`Notifying background service for job ${job.id}`);
      
      // Example: Send webhook to background service
      // await fetch('https://your-background-service.com/process', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     jobId: job.id,
      //     r2Key: job.r2Key,
      //     fileType: job.fileType,
      //     priority: job.priority,
      //     processingOptions: job.processingOptions
      //   })
      // });

    } catch (error) {
      console.warn('Failed to notify background service:', error);
      // Non-critical error - job will be picked up by background service polling
    }
  }

  private async getJobFromDatabase(jobId: string, userId: string): Promise<ProcessingJob | null> {
    try {
      const sql = `
        SELECT * FROM processing_jobs 
        WHERE id = ? AND user_id = ?
      `;
      
      const result = await this.database.prepare(sql).bind(jobId, userId).first();
      
      if (!result) {
        return null;
      }

      return {
        id: result.id,
        userId: result.user_id,
        courseId: result.course_id,
        fileName: result.file_name,
        fileType: result.file_type,
        fileSize: result.file_size,
        r2Key: result.r2_key,
        status: result.status as ProcessingJobStatus,
        priority: result.priority as 'low' | 'normal' | 'high',
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
        startedAt: result.started_at ? new Date(result.started_at) : undefined,
        completedAt: result.completed_at ? new Date(result.completed_at) : undefined,
        estimatedCompletion: result.estimated_completion ? new Date(result.estimated_completion) : undefined,
        callbackUrl: result.callback_url,
        processingOptions: JSON.parse(result.processing_options || '{}'),
        result: result.result ? JSON.parse(result.result) : undefined,
        error: result.error
      };

    } catch (error) {
      console.error(`Failed to get job ${jobId} from database:`, error);
      return null;
    }
  }

  private async updateJobStatus(jobId: string, status: ProcessingJobStatus): Promise<void> {
    try {
      const sql = `
        UPDATE processing_jobs 
        SET status = ?, updated_at = ?
        WHERE id = ?
      `;
      
      await this.database.prepare(sql).bind(
        status,
        new Date().toISOString(),
        jobId
      ).run();

    } catch (error) {
      console.error(`Failed to update job status for ${jobId}:`, error);
      throw error;
    }
  }

  private async cleanupR2File(r2Key: string): Promise<void> {
    try {
      await this.r2Storage.delete(r2Key);
      console.log(`Cleaned up R2 file: ${r2Key}`);
    } catch (error) {
      console.warn(`Failed to cleanup R2 file ${r2Key}:`, error);
      // Non-critical error
    }
  }
}