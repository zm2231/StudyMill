/**
 * Document Processing API Routes
 * 
 * Handles document upload, processing, and retrieval using the unified processor
 */

import { Hono } from 'hono';
import { UnifiedDocumentProcessor, UnifiedProcessingOptions } from '../services/unifiedDocumentProcessor';
import { ErrorHandler } from '../utils/processing-errors';
import { DatabaseService } from '../services/database';
import { authMiddleware } from '../middleware/auth';

interface Env {
  PARSE_EXTRACT_API_KEY?: string;
  R2_STORAGE: any; // R2 bucket binding
  DB: any; // D1 database binding
}

const documents = new Hono<{ Bindings: Env }>();

// Apply auth middleware to protected routes
documents.use('/', authMiddleware);
documents.use('/:id', authMiddleware);
documents.use('/:id/*', authMiddleware);

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

/**
 * GET /documents
 * List user's documents with filtering and pagination
 */
documents.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const courseId = c.req.query('courseId');
    const types = c.req.query('types')?.split(',');
    const tags = c.req.query('tags')?.split(',');
    const query = c.req.query('query');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const dbService = new DatabaseService(c.env.DB);
    
    // Build WHERE conditions
    let whereConditions = ['user_id = ?'];
    let params: any[] = [userId];
    
    if (courseId) {
      whereConditions.push('course_id = ?');
      params.push(courseId);
    }
    
    if (types && types.length > 0) {
      whereConditions.push(`file_type IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
    
    if (query) {
      whereConditions.push('(filename LIKE ? OR processing_status LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }

    const whereClause = whereConditions.join(' AND ');
    
    // Get documents with course information
    const sql = `
      SELECT 
        d.*,
        c.name as course_name,
        c.description as course_description
      FROM documents d
      LEFT JOIN courses c ON d.course_id = c.id
      WHERE ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    
    const result = await dbService.query(sql, params);
    const documents = result.results || [];

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM documents d WHERE ${whereClause.replace(/, LIMIT.*$/, '')}`;
    const countResult = await dbService.query(countSql, params.slice(0, -2));
    const total = (countResult.results?.[0] as any)?.total || 0;

    // Transform documents to match frontend expectations
    const transformedDocuments = documents.map((doc: any) => ({
      id: doc.id,
      title: doc.filename.replace(/\.[^/.]+$/, ""), // Remove extension
      type: doc.file_type,
      fileUrl: doc.processing_status === 'ready' ? `/api/v1/documents/${doc.id}/content` : undefined,
      course: doc.course_name ? {
        name: doc.course_name,
        color: '#4A7C2A', // Default color, TODO: get from course
        code: doc.course_name // Simplified for now
      } : undefined,
      tags: [], // TODO: implement tags
      updatedAt: new Date(doc.updated_at),
      status: doc.processing_status === 'ready' ? 'ready' : 
              doc.processing_status === 'processing' ? 'processing' : 'error',
      size: doc.file_size,
      syncStatus: 'synced' as const
    }));

    return c.json({
      success: true,
      documents: transformedDocuments,
      pagination: {
        total,
        limit,
        offset,
        has_more: total > offset + limit
      }
    });

  } catch (error: any) {
    console.error('Get documents error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get documents'
    }, 500);
  }
});

/**
 * GET /documents/:id
 * Get specific document by ID
 */
documents.get('/:id', async (c) => {
  try {
    const documentId = c.req.param('id');
    const userId = c.get('userId');

    const dbService = new DatabaseService(c.env.DB);
    
    const sql = `
      SELECT 
        d.*,
        c.name as course_name,
        c.description as course_description
      FROM documents d
      LEFT JOIN courses c ON d.course_id = c.id
      WHERE d.id = ? AND d.user_id = ?
    `;
    
    const result = await dbService.query(sql, [documentId, userId]);
    const doc = (result.results?.[0] as any);

    if (!doc) {
      return c.json({
        success: false,
        error: 'Document not found'
      }, 404);
    }

    // Transform document to match frontend expectations
    const transformedDocument = {
      id: doc.id,
      title: doc.filename.replace(/\.[^/.]+$/, ""),
      type: doc.file_type,
      fileUrl: doc.processing_status === 'ready' ? `/api/v1/documents/${doc.id}/content` : undefined,
      course: doc.course_name ? {
        name: doc.course_name,
        color: '#4A7C2A',
        code: doc.course_name
      } : undefined,
      tags: [],
      updatedAt: new Date(doc.updated_at),
      status: doc.processing_status === 'ready' ? 'ready' : 
              doc.processing_status === 'processing' ? 'processing' : 'error',
      size: doc.file_size,
      syncStatus: 'synced' as const,
      canEdit: doc.file_type === 'note' || doc.file_type === 'text'
    };

    return c.json({
      success: true,
      document: transformedDocument
    });

  } catch (error: any) {
    console.error('Get document error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get document'
    }, 500);
  }
});

/**
 * GET /documents/:id/content
 * Get document content (for download/viewing)
 */
documents.get('/:id/content', async (c) => {
  try {
    const documentId = c.req.param('id');
    const userId = c.get('userId');

    const dbService = new DatabaseService(c.env.DB);
    
    // Get document info
    const sql = 'SELECT * FROM documents WHERE id = ? AND user_id = ?';
    const result = await dbService.query(sql, [documentId, userId]);
    const doc = (result.results?.[0] as any);

    if (!doc) {
      return c.json({
        success: false,
        error: 'Document not found'
      }, 404);
    }

    if (doc.processing_status !== 'ready') {
      return c.json({
        success: false,
        error: 'Document not ready for download'
      }, 400);
    }

    // Get file from R2
    const object = await c.env.R2_STORAGE.get(doc.r2_key);
    
    if (!object) {
      return c.json({
        success: false,
        error: 'File not found in storage'
      }, 404);
    }

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', doc.file_type || 'application/octet-stream');
    headers.set('Content-Disposition', `inline; filename="${doc.filename}"`);
    
    return new Response(object.body, {
      headers
    });

  } catch (error: any) {
    console.error('Get document content error:', error);
    return c.json({
      success: false,
      error: error.message || 'Failed to get document content'
    }, 500);
  }
});

export default documents;