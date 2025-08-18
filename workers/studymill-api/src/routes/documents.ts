/**
 * Document Processing API Routes
 * 
 * Handles document upload, processing, and retrieval using the unified processor
 */

import { Hono } from 'hono';
import { UnifiedDocumentProcessor, UnifiedProcessingOptions } from '../services/unifiedDocumentProcessor';
import { ErrorHandler } from '../utils/processing-errors';

interface Env {
  PARSE_EXTRACT_API_KEY?: string;
  R2_STORAGE: any; // R2 bucket binding
  DB: any; // D1 database binding
}

const documents = new Hono<{ Bindings: Env }>();

/**
 * POST /documents/process
 * Process a document (direct or async based on file type and size)
 */
documents.post('/process', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const courseId = formData.get('courseId') as string;
    
    // Processing options
    const forceAsync = formData.get('forceAsync') === 'true';
    const forceDirect = formData.get('forceDirect') === 'true';
    const preserveFormatting = formData.get('preserveFormatting') === 'true';
    const extractMetadata = formData.get('extractMetadata') === 'true';
    const requireAdvancedFeatures = formData.get('requireAdvancedFeatures') === 'true';
    const priority = (formData.get('priority') as 'low' | 'normal' | 'high') || 'normal';
    const maxAsyncWaitTime = parseInt(formData.get('maxAsyncWaitTime') as string) || 0;

    if (!file) {
      return c.json({ 
        success: false, 
        error: 'No file provided' 
      }, 400);
    }

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID required' 
      }, 400);
    }

    // Validate file
    if (file.size === 0) {
      return c.json({ 
        success: false, 
        error: 'Empty file' 
      }, 400);
    }

    const fileBuffer = await file.arrayBuffer();
    
    // Initialize processor
    const processor = new UnifiedDocumentProcessor(
      c.env.PARSE_EXTRACT_API_KEY,
      c.env.R2_STORAGE,
      c.env.DB
    );

    // Process options
    const options: UnifiedProcessingOptions = {
      userId,
      courseId,
      forceAsync,
      forceDirect,
      preserveFormatting,
      extractMetadata,
      requireAdvancedFeatures,
      priority,
      maxAsyncWaitTime
    };

    // Process document
    const result = await processor.processDocument(
      fileBuffer,
      file.type,
      file.name,
      options
    );

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error,
        recommendation: result.recommendation
      }, 400);
    }

    return c.json({
      success: true,
      isAsync: result.isAsync,
      data: result.data,
      chunks: result.chunks
    });

  } catch (error) {
    console.error('Document processing error:', error);
    
    const mappedError = ErrorHandler.createErrorResponse(
      error instanceof Error ? error : new Error('Unknown error')
    );
    
    return c.json(mappedError, 500);
  }
});

/**
 * GET /documents/jobs/:jobId/status
 * Check status of async processing job
 */
documents.get('/jobs/:jobId/status', async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID required in header' 
      }, 401);
    }

    const processor = new UnifiedDocumentProcessor(
      c.env.PARSE_EXTRACT_API_KEY,
      c.env.R2_STORAGE,
      c.env.DB
    );

    const result = await processor.checkAsyncJobStatus(jobId, userId);

    return c.json(result);

  } catch (error) {
    console.error('Job status check error:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check job status'
    }, 500);
  }
});

/**
 * GET /documents/recommendation
 * Get processing recommendation for a file (without actually processing)
 */
documents.get('/recommendation', async (c) => {
  try {
    const fileSize = parseInt(c.req.query('fileSize') || '0');
    const fileType = c.req.query('fileType') || '';
    const fileName = c.req.query('fileName') || '';

    if (!fileSize || !fileType || !fileName) {
      return c.json({ 
        success: false, 
        error: 'fileSize, fileType, and fileName query parameters required' 
      }, 400);
    }

    const processor = new UnifiedDocumentProcessor(
      c.env.PARSE_EXTRACT_API_KEY,
      c.env.R2_STORAGE,
      c.env.DB
    );

    const recommendation = processor.getProcessingRecommendation(
      fileSize,
      fileType,
      fileName
    );

    return c.json({
      success: true,
      recommendation
    });

  } catch (error) {
    console.error('Recommendation error:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recommendation'
    }, 500);
  }
});

/**
 * GET /documents/jobs
 * Get user's processing jobs with pagination
 */
documents.get('/jobs', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');
    const status = c.req.query('status');
    const courseId = c.req.query('courseId');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID required in header' 
      }, 401);
    }

    const processor = new UnifiedDocumentProcessor(
      c.env.PARSE_EXTRACT_API_KEY,
      c.env.R2_STORAGE,
      c.env.DB
    );

    // This would use the AsyncDocumentProcessor.getUserJobs method
    const result = await processor.asyncProcessor?.getUserJobs(userId, {
      status: status as any,
      courseId,
      limit,
      offset
    });

    return c.json(result || { success: false, error: 'Async processor not available' });

  } catch (error) {
    console.error('Get jobs error:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get jobs'
    }, 500);
  }
});

/**
 * DELETE /documents/jobs/:jobId
 * Cancel processing job (if not started yet)
 */
documents.delete('/jobs/:jobId', async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID required in header' 
      }, 401);
    }

    const processor = new UnifiedDocumentProcessor(
      c.env.PARSE_EXTRACT_API_KEY,
      c.env.R2_STORAGE,
      c.env.DB
    );

    const result = await processor.asyncProcessor?.cancelJob(jobId, userId);

    return c.json(result || { success: false, error: 'Async processor not available' });

  } catch (error) {
    console.error('Cancel job error:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel job'
    }, 500);
  }
});

/**
 * GET /documents/stats
 * Get processing statistics for the user
 */
documents.get('/stats', async (c) => {
  try {
    const userId = c.req.header('X-User-ID');

    if (!userId) {
      return c.json({ 
        success: false, 
        error: 'User ID required in header' 
      }, 401);
    }

    const processor = new UnifiedDocumentProcessor(
      c.env.PARSE_EXTRACT_API_KEY,
      c.env.R2_STORAGE,
      c.env.DB
    );

    const stats = await processor.getProcessingStats(userId);

    return c.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats'
    }, 500);
  }
});

/**
 * POST /documents/webhook/processing-complete
 * Webhook endpoint for background service to notify completion
 */
documents.post('/webhook/processing-complete', async (c) => {
  try {
    const body = await c.req.json();
    const { jobId, status, result, error } = body;

    // Verify webhook authenticity (implement proper authentication)
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${c.env.WEBHOOK_SECRET}`) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log(`Webhook received for job ${jobId}: ${status}`);

    // Update job status in database
    // This would typically trigger notifications to the user
    
    return c.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed'
    }, 500);
  }
});

export default documents;