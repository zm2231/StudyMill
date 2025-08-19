import { Hono } from 'hono';
import { createError } from '../middleware/error';
import { authMiddleware } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { CourseService } from '../services/course';
import { DocumentService } from '../services/document';
import { DocumentProcessorService } from '../services/documentProcessor';
import { VectorService } from '../services/vector';
import { SemanticSearchService } from '../services/semanticSearch';
import { createAudioProcessor, AudioProcessor } from '../services/audioProcessor';
import { EnhancedMemoryService } from '../services/enhancedMemory';
import { memoryRoutes } from './memories';

export const apiRoutes = new Hono();

// Public routes (no auth required) - mount these first
const publicDocumentsRoutes = new Hono();
publicDocumentsRoutes.get('/supported-types', async (c) => {
  return c.json({
    success: true,
    supportedFileTypes: DocumentService.getSupportedFileTypes(),
    supportedExtensions: DocumentService.getSupportedExtensions(),
    maxFileSize: DocumentService.getMaxFileSize(),
    maxFileSizeMB: Math.round(DocumentService.getMaxFileSize() / 1024 / 1024)
  });
});
apiRoutes.route('/documents', publicDocumentsRoutes);

// Apply authentication middleware to all other API routes (except WebSocket endpoints)
apiRoutes.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  
  // Skip auth for WebSocket endpoints
  if (url.pathname.includes('/chat/ws')) {
    return next();
  }
  
  return authMiddleware(c, next);
});

// Courses routes
const coursesRoutes = new Hono();

coursesRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const courseService = new CourseService(dbService);
  
  // Get courses with real memory counts from database
  const coursesWithCounts = await courseService.getUserCoursesWithMemoryCounts(userId);
  
  // Transform courses to match frontend expectations
  const transformedCourses = coursesWithCounts.map(course => ({
    ...course,
    schedule: [], // Empty schedule array until scheduling is implemented
    semester: {
      startDate: '2025-08-15',
      endDate: '2025-12-15',
      name: 'Fall 2025'
    }
    // memoryCount is now included from getUserCoursesWithMemoryCounts
  }));
  
  return c.json({
    success: true,
    courses: transformedCourses
  });
});

coursesRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const courseData = await c.req.json();
  
  const dbService = new DatabaseService(c.env.DB);
  const courseService = new CourseService(dbService);
  
  // For now, extract basic fields and ignore complex schedule/semester data
  // TODO: Implement full course creation with schedules
  const basicCourseData = {
    name: courseData.name,
    description: courseData.description,
    code: courseData.code,
    color: courseData.color || '#3b82f6',
    instructor: courseData.instructor,
    credits: courseData.credits || 3
  };
  
  const course = await courseService.createCourse(userId, basicCourseData);
  
  return c.json({
    success: true,
    course: {
      ...course,
      schedule: courseData.schedule || [],
      semester: courseData.semester || {
        startDate: '2025-08-15',
        endDate: '2025-12-15',
        name: 'Fall 2025'
      },
      memoryCount: 0
    }
  }, 201);
});

// Today's classes endpoint - must come before /:id route
coursesRoutes.get('/today', async (c) => {
  const userId = c.get('userId');
  
  // For now, return an empty array to prevent frontend crashes
  // TODO: Implement actual today's classes logic with course schedules
  return c.json({
    success: true,
    classes: []
  });
});

coursesRoutes.get('/:id', async (c) => {
  const courseId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const courseService = new CourseService(dbService);
  
  const course = await courseService.getCourse(courseId, userId);
  
  // Get real memory count for this specific course
  const memoryCount = await dbService.getMemoryCountByCourse(courseId, userId);
  
  return c.json({
    success: true,
    course: {
      ...course,
      schedule: [], // Empty schedule array until scheduling is implemented
      semester: {
        startDate: '2025-08-15',
        endDate: '2025-12-15',
        name: 'Fall 2025'
      },
      memoryCount // Real memory count from database
    }
  });
});

coursesRoutes.put('/:id', async (c) => {
  const courseId = c.req.param('id');
  const userId = c.get('userId');
  const { name, description } = await c.req.json();
  
  const dbService = new DatabaseService(c.env.DB);
  const courseService = new CourseService(dbService);
  
  const course = await courseService.updateCourse(courseId, userId, { name, description });
  
  return c.json({
    success: true,
    course
  });
});

coursesRoutes.delete('/:id', async (c) => {
  const courseId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const courseService = new CourseService(dbService);
  
  await courseService.deleteCourse(courseId, userId);
  
  return c.json({
    success: true,
    message: 'Course deleted successfully'
  });
});


// Documents routes
const documentsRoutes = new Hono();

documentsRoutes.post('/upload', async (c) => {
  const userId = c.get('userId');
  const formData = await c.req.formData();
  
  const file = formData.get('file') as File;
  const courseId = formData.get('courseId') as string;
  const documentType = formData.get('documentType') as string;
  
  if (!file) {
    createError('File is required', 400, { field: 'file' });
  }
  
  if (!courseId) {
    createError('Course ID is required', 400, { field: 'courseId' });
  }
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  
  // Convert file to buffer
  const fileBuffer = await file.arrayBuffer();
  
  const document = await documentService.uploadDocument(userId, {
    courseId,
    filename: file.name,
    fileType: file.type,
    fileSize: file.size,
    documentType: documentType as any
  }, fileBuffer);
  
  return c.json({
    success: true,
    document
  }, 201);
});

documentsRoutes.get('/:id', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  
  const document = await documentService.getDocument(documentId, userId);
  if (!document) {
    createError('Document not found', 404);
  }
  
  return c.json({
    success: true,
    document
  });
});

documentsRoutes.delete('/:id', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  
  await documentService.deleteDocument(documentId, userId);
  
  return c.json({
    success: true,
    message: 'Document deleted successfully'
  });
});

documentsRoutes.get('/:id/processing-status', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  
  const document = await documentService.getDocument(documentId, userId);
  if (!document) {
    createError('Document not found', 404);
  }
  
  return c.json({
    success: true,
    documentId,
    status: document.processing_status,
    error: document.processing_error || null
  });
});

documentsRoutes.get('/:id/download', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  
  const document = await documentService.getDocument(documentId, userId);
  if (!document) {
    createError('Document not found', 404);
  }
  
  // Get the actual file from R2
  const object = await c.env.BUCKET.get(document.r2_key);
  if (!object) {
    createError('Document file not found in storage', 404);
  }
  
  // Return the file directly
  return new Response(object.body, {
    headers: {
      'Content-Type': document.file_type,
      'Content-Disposition': `attachment; filename="${document.filename}"`,
      'Content-Length': document.file_size.toString()
    }
  });
});

// List all user documents with filtering
documentsRoutes.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    const courseId = c.req.query('courseId');
    const types = c.req.query('types')?.split(',');
    const tags = c.req.query('tags')?.split(',');
    const query = c.req.query('query');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const dbService = new DatabaseService(c.env.DB);
    
    // Build WHERE conditions with proper table aliases
    let whereConditions = ['d.user_id = ?'];
    let params: any[] = [userId];
    
    if (courseId) {
      whereConditions.push('d.course_id = ?');
      params.push(courseId);
    }
    
    if (types && types.length > 0) {
      whereConditions.push(`d.file_type IN (${types.map(() => '?').join(',')})`)
      params.push(...types);
    }
    
    if (query) {
      whereConditions.push('(d.filename LIKE ? OR d.processing_status LIKE ?)');
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

// Add route to list documents for a course
documentsRoutes.get('/course/:courseId', async (c) => {
  const courseId = c.req.param('courseId');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  
  const documents = await documentService.getCourseDocuments(courseId, userId);
  
  return c.json({
    success: true,
    documents
  });
});

// Document processing endpoints
documentsRoutes.post('/:id/process', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  // Parse processing mode from request body
  const body = await c.req.json().catch(() => ({}));
  const processingMode = body.mode as 'basic' | 'premium' | 'auto' || 'auto';
  
  // Validate processing mode
  if (!['basic', 'premium', 'auto'].includes(processingMode)) {
    return c.json({
      success: false,
      error: 'Invalid processing mode. Must be "basic", "premium", or "auto"'
    }, 400);
  }
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  const processorService = new DocumentProcessorService(
    dbService, 
    documentService, 
    c.env.BUCKET,
    c.env.VECTORIZE,
    c.env.PARSE_EXTRACT_API_KEY,
    c.env.AI
  );
  
  const job = await processorService.queueDocumentProcessing(documentId, userId, processingMode);
  
  return c.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      processingMode: job.processingMode,
      costEstimate: job.costEstimate
    }
  }, 202);
});

documentsRoutes.get('/:id/content', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  const processorService = new DocumentProcessorService(
    dbService, 
    documentService, 
    c.env.BUCKET,
    c.env.VECTORIZE,
    c.env.PARSE_EXTRACT_API_KEY,
    c.env.AI
  );
  
  const content = await processorService.getProcessedContent(documentId, userId);
  
  return c.json({
    success: true,
    content
  });
});

// ENHANCED: Document search endpoint using hybrid vector architecture
documentsRoutes.get('/search', async (c) => {
  const userId = c.get('userId');
  const query = c.req.query('q');
  const courseId = c.req.query('courseId');
  const limit = parseInt(c.req.query('limit') || '10');
  
  if (!query) {
    createError('Search query is required', 400, { field: 'q' });
  }
  
  // Use the enhanced document search for structure-optimized results
  const dbService = new DatabaseService(c.env.DB);
  const vectorService = new VectorService(
    c.env.AI,
    c.env.VECTORIZE,
    dbService
  );
  const searchService = new SemanticSearchService(vectorService, dbService);
  
  // Perform document-optimized search
  const results = await searchService.searchDocuments(query, {
    topK: limit,
    filters: courseId ? { courseId } : {},
    includeMetadata: true,
    userId
  });
  
  return c.json({
    success: true,
    query,
    searchType: 'document_optimized',
    ...results
  });
});

documentsRoutes.get('/stats', async (c) => {
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  const processorService = new DocumentProcessorService(
    dbService, 
    documentService, 
    c.env.BUCKET,
    c.env.VECTORIZE,
    c.env.PARSE_EXTRACT_API_KEY,
    c.env.AI
  );
  
  const stats = await processorService.getUserProcessingStats(userId);
  
  return c.json({
    success: true,
    stats
  });
});

// Vector search status endpoint
documentsRoutes.get('/:id/vector-status', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  const processorService = new DocumentProcessorService(
    dbService, 
    documentService, 
    c.env.BUCKET,
    c.env.VECTORIZE,
    c.env.PARSE_EXTRACT_API_KEY,
    c.env.AI
  );
  
  const status = await processorService.getVectorSearchStatus(documentId, userId);
  
  return c.json({
    success: true,
    vectorSearch: status
  });
});

// Reindex document for vector search
documentsRoutes.post('/:id/reindex', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  const processorService = new DocumentProcessorService(
    dbService, 
    documentService, 
    c.env.BUCKET,
    c.env.VECTORIZE,
    c.env.PARSE_EXTRACT_API_KEY,
    c.env.AI
  );
  
  const result = await processorService.reindexDocument(documentId, userId);
  
  return c.json({
    success: true,
    indexingStats: result
  }, 202);
});

// Get processing cost analytics for user
documentsRoutes.get('/analytics/costs', async (c) => {
  const userId = c.get('userId');
  const days = parseInt(c.req.query('days') || '30');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  const processorService = new DocumentProcessorService(
    dbService, 
    documentService, 
    c.env.BUCKET,
    c.env.VECTORIZE,
    c.env.PARSE_EXTRACT_API_KEY,
    c.env.AI
  );
  
  const costSummary = await processorService.getUserCostSummary(userId, days);
  
  return c.json({
    success: true,
    period: `${days} days`,
    costSummary
  });
});

// Chat routes
const chatRoutes = new Hono();

// WebSocket chat endpoint
chatRoutes.get('/ws', async (c) => {
  const upgrade = c.req.header('Upgrade');
  
  if (upgrade !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426);
  }

  // Get session ID from query params
  const sessionId = c.req.query('sessionId') || crypto.randomUUID();
  
  // Get Durable Object instance for this session
  const durableObjectId = c.env.CHAT_DO.idFromName(sessionId);
  const chatDO = c.env.CHAT_DO.get(durableObjectId);
  
  // Forward the WebSocket upgrade request to the Durable Object
  return chatDO.fetch(c.req.raw);
});

chatRoutes.get('/sessions', async (c) => {
  // TODO: Get user chat sessions from D1
  return c.json({
    message: 'Get chat sessions endpoint - coming soon',
    sessions: []
  });
});

chatRoutes.post('/sessions', async (c) => {
  try {
    const { courseId, assignmentId, title } = await c.req.json();
    
    // TODO: Create new chat session in D1
    return c.json({
      message: 'Create chat session endpoint - coming soon',
      session: { courseId, assignmentId, title }
    }, 201);
  } catch (error) {
    throw error;
  }
});

chatRoutes.get('/sessions/:id/messages', async (c) => {
  const sessionId = c.req.param('id');
  
  // TODO: Get chat messages from D1
  return c.json({
    message: 'Get chat messages endpoint - coming soon',
    sessionId,
    messages: []
  });
});

chatRoutes.post('/sessions/:id/messages', async (c) => {
  const sessionId = c.req.param('id');
  
  try {
    const { content } = await c.req.json();
    
    if (!content) {
      createError('Message content is required', 400);
    }

    // TODO: Implement AI chat
    // - Store user message in D1
    // - Retrieve relevant context from Vectorize
    // - Generate AI response with Gemini
    // - Store AI response in D1
    // - Return streaming response
    
    return c.json({
      message: 'Send chat message endpoint - coming soon',
      sessionId,
      userMessage: content
    }, 201);
  } catch (error) {
    throw error;
  }
});

// ENHANCED: Search routes with unified academic workflows
const searchRoutes = new Hono();

// PHASE 3: Academic workflow routing endpoint
searchRoutes.post('/academic', async (c) => {
  try {
    const userId = c.get('userId');
    const { 
      query, 
      workflow, // 'research', 'writing', 'studying', 'synthesis'
      topK = 10,
      filters = {}
    } = await c.req.json();
    
    if (!query) {
      createError('Search query is required', 400);
    }

    if (!workflow) {
      createError('Academic workflow is required', 400);
    }

    // Initialize services
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.AI,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    // Route to appropriate search based on academic workflow
    let results;
    switch (workflow) {
      case 'research':
      case 'citation':
        // Research workflow: prioritize document vectors for citations
        results = await searchService.searchDocuments(query, {
          topK,
          filters,
          includeMetadata: true,
          userId
        });
        break;
        
      case 'studying':
      case 'review':
        // Study workflow: prioritize memory vectors for personal connections
        results = await searchService.searchMemories(query, {
          topK,
          filters,
          includeMetadata: true,
          userId
        });
        break;
        
      case 'synthesis':
      case 'writing':
        // Synthesis workflow: use unified search for comprehensive results
        results = await searchService.unifiedSearch(query, {
          topK,
          filters,
          includeMetadata: true,
          userId
        });
        break;
        
      default:
        // Default to unified search
        results = await searchService.unifiedSearch(query, {
          topK,
          filters,
          includeMetadata: true,
          userId
        });
    }

    // Add workflow-specific metadata to results
    const enhancedResults = {
      ...results,
      workflow,
      workflowOptimized: true,
      recommendations: this.getWorkflowRecommendations(workflow, results.results)
    };

    return c.json({
      success: true,
      ...enhancedResults
    });

  } catch (error) {
    console.error('Academic workflow search failed:', error);
    throw error;
  }
});

// PHASE 3: Citation-ready search endpoint
searchRoutes.post('/citations', async (c) => {
  try {
    const userId = c.get('userId');
    const { 
      query, 
      topK = 10,
      filters = {},
      citationStyle = 'apa' // apa, mla, chicago
    } = await c.req.json();
    
    if (!query) {
      createError('Search query is required', 400);
    }

    // Initialize services
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.AI,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    // Use document search for citation-ready results
    const results = await searchService.searchDocuments(query, {
      topK,
      filters,
      includeMetadata: true,
      userId
    });

    // Add citation metadata to each result
    const citationResults = {
      ...results,
      searchType: 'citation_ready',
      citationStyle,
      results: results.results.map(result => ({
        ...result,
        citation: this.generateCitation(result, citationStyle),
        citationElements: this.extractCitationElements(result)
      }))
    };

    return c.json({
      success: true,
      ...citationResults
    });

  } catch (error) {
    console.error('Citation search failed:', error);
    throw error;
  }
});

// ENHANCED: Document search endpoint for structure-optimized vectors
searchRoutes.post('/documents', async (c) => {
  try {
    const userId = c.get('userId');
    const { 
      query, 
      topK = 10,
      filters = {}
    } = await c.req.json();
    
    if (!query) {
      createError('Search query is required', 400);
    }

    // Initialize services
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.AI,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    // Perform document-optimized search
    const results = await searchService.searchDocuments(query, {
      topK,
      filters,
      includeMetadata: true,
      userId
    });

    return c.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Document search failed:', error);
    throw error;
  }
});

// ENHANCED: Memory search endpoint for context-optimized vectors
searchRoutes.post('/memories', async (c) => {
  try {
    const userId = c.get('userId');
    const { 
      query, 
      topK = 10,
      filters = {}
    } = await c.req.json();
    
    if (!query) {
      createError('Search query is required', 400);
    }

    // Initialize services
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.AI,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    // Perform memory-optimized search
    const results = await searchService.searchMemories(query, {
      topK,
      filters,
      includeMetadata: true,
      userId
    });

    return c.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Memory search failed:', error);
    throw error;
  }
});

// ENHANCED: Unified search endpoint with intelligent ranking
searchRoutes.post('/unified', async (c) => {
  try {
    const userId = c.get('userId');
    const { 
      query, 
      topK = 10,
      filters = {}
    } = await c.req.json();
    
    if (!query) {
      createError('Search query is required', 400);
    }

    // Initialize services
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.AI,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    // Perform unified search with intelligent ranking
    const results = await searchService.unifiedSearch(query, {
      topK,
      filters,
      includeMetadata: true,
      userId
    });

    return c.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Unified search failed:', error);
    throw error;
  }
});

// LEGACY: Semantic search endpoint (deprecated but maintained for compatibility)
searchRoutes.post('/semantic', async (c) => {
  try {
    const userId = c.get('userId');
    const { 
      query, 
      searchType = 'hybrid',
      topK = 10,
      filters = {}
    } = await c.req.json();
    
    if (!query) {
      createError('Search query is required', 400);
    }

    // Initialize services
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.AI,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    // Default to unified search for best results
    const results = await searchService.unifiedSearch(query, {
      topK,
      filters,
      includeMetadata: true,
      userId
    });

    return c.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Semantic search failed:', error);
    throw error;
  }
});

// ENHANCED: Quick search endpoint (for autocomplete/instant search)
searchRoutes.get('/quick', async (c) => {
  try {
    const userId = c.get('userId');
    const query = c.req.query('q');
    const courseId = c.req.query('courseId');
    const searchType = c.req.query('type') || 'unified'; // documents, memories, or unified
    const limit = parseInt(c.req.query('limit') || '5');

    if (!query || query.length < 2) {
      return c.json({
        success: true,
        results: [],
        totalResults: 0,
        searchTime: 0,
        searchType: 'quick_' + searchType,
        query: query || ''
      });
    }

    // Initialize services
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.AI,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    // Choose search method based on type
    let results;
    const filters = courseId ? { courseId } : {};
    
    switch (searchType) {
      case 'documents':
        results = await searchService.searchDocuments(query, {
          topK: limit,
          filters,
          includeMetadata: false,
          userId
        });
        break;
      case 'memories':
        results = await searchService.searchMemories(query, {
          topK: limit,
          filters,
          includeMetadata: false,
          userId
        });
        break;
      default:
        results = await searchService.unifiedSearch(query, {
          topK: limit,
          filters,
          includeMetadata: false,
          userId
        });
    }

    return c.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Quick search failed:', error);
    throw error;
  }
});

// Search suggestions endpoint
searchRoutes.get('/suggestions', async (c) => {
  try {
    const query = c.req.query('q');
    const limit = parseInt(c.req.query('limit') || '5');
    
    if (!query || query.length < 2) {
      return c.json({
        success: true,
        suggestions: []
      });
    }

    // Initialize services
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.AI,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    const suggestions = await searchService.getSearchSuggestions(query, limit);

    return c.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('Search suggestions failed:', error);
    throw error;
  }
});

// PHASE 3: Helper functions for academic workflows
function getWorkflowRecommendations(workflow: string, results: any[]): string[] {
  const recommendations = [];
  
  switch (workflow) {
    case 'research':
    case 'citation':
      recommendations.push('Results optimized for citations and references');
      if (results.some(r => r.pageNumber)) {
        recommendations.push('Page numbers available for accurate citations');
      }
      recommendations.push('Consider using /search/citations endpoint for formatted citations');
      break;
      
    case 'studying':
    case 'review':
      recommendations.push('Results prioritize your personal connections and insights');
      recommendations.push('Related memories may contain additional context');
      if (results.some(r => r.metadata?.relationships)) {
        recommendations.push('Relationship data available for deeper understanding');
      }
      break;
      
    case 'synthesis':
    case 'writing':
      recommendations.push('Results combine document structure with personal insights');
      recommendations.push('Use memory synthesis endpoint for AI-powered integration');
      break;
  }
  
  return recommendations;
}

function generateCitation(result: any, style: string): string {
  // Basic citation generation - could be enhanced with proper citation library
  const title = result.metadata?.document_title || result.documentId;
  const page = result.pageNumber ? `, p. ${result.pageNumber}` : '';
  
  switch (style) {
    case 'apa':
      return `Source: ${title}${page}`;
    case 'mla':
      return `"${result.text.substring(0, 50)}..." (${title}${page})`;
    case 'chicago':
      return `${title}${page}.`;
    default:
      return `${title}${page}`;
  }
}

function extractCitationElements(result: any): any {
  return {
    title: result.metadata?.document_title || result.documentId,
    page: result.pageNumber,
    chunk: result.chunkIndex,
    documentType: result.documentType,
    excerpt: result.text.substring(0, 200) + (result.text.length > 200 ? '...' : '')
  };
}

// Search analytics endpoint
searchRoutes.get('/analytics', async (c) => {
  try {
    const userId = c.get('userId');
    const courseId = c.req.query('courseId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const limit = parseInt(c.req.query('limit') || '10');

    // Initialize services
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.AI,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    const analytics = await searchService.getSearchAnalytics({
      userId,
      courseId: courseId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit
    });

    return c.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Search analytics failed:', error);
    throw error;
  }
});

// Assignments routes
const assignmentsRoutes = new Hono();

assignmentsRoutes.get('/', async (c) => {
  // TODO: Get user assignments from D1
  return c.json({
    message: 'Get assignments endpoint - coming soon',
    assignments: []
  });
});

assignmentsRoutes.post('/', async (c) => {
  try {
    const { courseId, title, description, dueDate, assignmentType } = await c.req.json();
    
    if (!courseId || !title) {
      createError('Course ID and title are required', 400);
    }

    // TODO: Create assignment in D1
    return c.json({
      message: 'Create assignment endpoint - coming soon',
      assignment: { courseId, title, description, dueDate, assignmentType }
    }, 201);
  } catch (error) {
    throw error;
  }
});

assignmentsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const updates = await c.req.json();
  
  // TODO: Update assignment in D1
  return c.json({
    message: 'Update assignment endpoint - coming soon',
    assignmentId: id,
    updates
  });
});

assignmentsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  // TODO: Delete assignment from D1
  return c.json({
    message: 'Delete assignment endpoint - coming soon',
    assignmentId: id
  });
});

// Audio routes
const audioRoutes = new Hono();

// Upload and transcribe audio file
audioRoutes.post('/upload', async (c) => {
  const userId = c.get('userId');
  const formData = await c.req.formData();
  
  const file = formData.get('file') as File;
  const courseId = formData.get('courseId') as string;
  const transcriptionOptions = formData.get('options') as string;
  
  if (!file) {
    createError('Audio file is required', 400, { field: 'file' });
  }
  
  if (!courseId) {
    createError('Course ID is required', 400, { field: 'courseId' });
  }

  // Validate audio file type
  const supportedTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 
    'audio/flac', 'audio/ogg', 'audio/webm'
  ];
  
  if (!supportedTypes.includes(file.type)) {
    createError('Unsupported audio format. Supported: MP3, WAV, M4A, FLAC, OGG, WebM', 400);
  }

  // Check file size (100MB limit for Groq dev tier)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    createError(`Audio file too large. Maximum size: ${maxSize / 1024 / 1024}MB`, 400);
  }

  // Parse transcription options
  let options = {};
  if (transcriptionOptions) {
    try {
      options = JSON.parse(transcriptionOptions);
    } catch (error) {
      createError('Invalid transcription options JSON', 400);
    }
  }

  const audioProcessor = createAudioProcessor(c.env);
  const fileBuffer = await file.arrayBuffer();
  
  try {
    // Transcribe the audio
    const transcription = await audioProcessor.transcribeAudio(
      fileBuffer,
      file.name,
      options
    );

    // Segment by topics
    const topicSegments = await audioProcessor.segmentByTopics(transcription, userId);

    // Generate audio file ID
    const audioFileId = crypto.randomUUID();

    // Create audio memory using simplified interface
    const audioMemory = await audioProcessor.createMemoriesFromAudio(
      transcription,
      topicSegments,
      audioFileId,
      userId
    );

    // ENHANCED: Create proper memories in the hybrid memory system
    const dbService = new DatabaseService(c.env.DB);
    // Use EnhancedMemoryService for user-facing audio memories (context-optimized)
    const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);
    
    const memories = await AudioProcessor.createMemoriesWithMemoryService(
      memoryService,
      transcription,
      topicSegments,
      audioFileId,
      userId,
      [courseId] // Use courseId as container tag
    );
    
    return c.json({
      success: true,
      audioFileId,
      transcription: {
        id: audioMemory.id,
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        processingTime: transcription.processingTime,
        backend: transcription.backend,
        segmentCount: transcription.segments.length,
        topicCount: topicSegments.length
      },
      memories: {
        count: memories.length,
        topics: memories
          .filter(m => m.metadata.memoryType === 'audio_topic_segment')
          .map(m => ({
            id: m.id,
            topic: m.metadata.topic,
            startTime: m.metadata.startTime,
            endTime: m.metadata.endTime,
            summary: m.metadata.summary,
            keyPoints: m.metadata.keyPoints
          })),
        fullTranscription: memories.find(m => m.metadata.memoryType === 'audio_full_transcription')?.id
      },
      audioMemory: {
        id: audioMemory.id,
        topics: audioMemory.topics.map(t => ({
          topic: t.topic,
          startTime: t.startTime,
          endTime: t.endTime,
          summary: t.summary
        })),
        concepts: audioMemory.extractedConcepts,
        metadata: audioMemory.metadata
      }
    }, 201);
    
  } catch (error) {
    console.error('Audio transcription failed:', error);
    throw error;
  }
});

// Get supported audio formats
audioRoutes.get('/supported-formats', async (c) => {
  return c.json({
    success: true,
    supportedFormats: [
      { 
        extension: 'mp3', 
        mimeType: 'audio/mpeg', 
        description: 'MPEG Audio Layer III' 
      },
      { 
        extension: 'wav', 
        mimeType: 'audio/wav', 
        description: 'Waveform Audio File' 
      },
      { 
        extension: 'm4a', 
        mimeType: 'audio/mp4', 
        description: 'MPEG-4 Audio' 
      },
      { 
        extension: 'flac', 
        mimeType: 'audio/flac', 
        description: 'Free Lossless Audio Codec' 
      },
      { 
        extension: 'ogg', 
        mimeType: 'audio/ogg', 
        description: 'Ogg Vorbis' 
      },
      { 
        extension: 'webm', 
        mimeType: 'audio/webm', 
        description: 'WebM Audio' 
      }
    ],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFileSizeMB: 100,
    recommendedFormats: ['mp3', 'wav', 'm4a'],
    backends: [
      {
        name: 'groq',
        description: 'Groq Whisper API - Fast cloud transcription',
        models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
        speedFactor: '216x real-time (turbo), 164x real-time (standard)',
        cost: '$0.04/hour (turbo), $0.111/hour (standard)'
      },
      {
        name: 'local',
        description: 'Local WhisperKit (future) - Private offline transcription',
        models: ['distil-whisper', 'whisper-large-v3'],
        speedFactor: 'Varies by device',
        cost: 'Free after model download',
        status: 'Coming soon'
      }
    ]
  });
});

// Get transcription status
audioRoutes.get('/:id/status', async (c) => {
  const transcriptionId = c.req.param('id');
  const userId = c.get('userId');
  
  // TODO: Implement status checking from database
  return c.json({
    success: true,
    transcriptionId,
    status: 'completed', // pending, processing, completed, failed
    message: 'Status checking not yet implemented'
  });
});

// Get transcription details
audioRoutes.get('/:id', async (c) => {
  const audioFileId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);
  
  try {
    const fullTranscription = await memoryService.getFullAudioTranscription(userId, audioFileId);
    
    if (!fullTranscription) {
      createError('Audio transcription not found', 404);
    }
    
    return c.json({
      success: true,
      audioFileId,
      transcription: {
        id: fullTranscription.id,
        text: fullTranscription.content,
        metadata: fullTranscription.metadata,
        createdAt: fullTranscription.createdAt
      }
    });
  } catch (error) {
    console.error('Failed to get transcription:', error);
    throw error;
  }
});

// Search audio memories by timestamp
audioRoutes.get('/:id/timestamp/:startTime/:endTime', async (c) => {
  const audioFileId = c.req.param('id');
  const startTime = parseFloat(c.req.param('startTime'));
  const endTime = parseFloat(c.req.param('endTime'));
  const userId = c.get('userId');
  
  if (isNaN(startTime) || isNaN(endTime)) {
    createError('Invalid timestamp format. Use numeric values in seconds.', 400);
  }
  
  const dbService = new DatabaseService(c.env.DB);
  const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);
  
  try {
    const memories = await memoryService.searchAudioMemoriesByTimestamp(
      userId, 
      audioFileId, 
      startTime, 
      endTime
    );
    
    return c.json({
      success: true,
      audioFileId,
      timeRange: { startTime, endTime },
      memories: memories.map(memory => ({
        id: memory.id,
        content: memory.content,
        startTime: memory.metadata.startTime,
        endTime: memory.metadata.endTime,
        topic: memory.metadata.topic,
        summary: memory.metadata.summary,
        keyPoints: memory.metadata.keyPoints,
        confidence: memory.metadata.confidence
      }))
    });
  } catch (error) {
    console.error('Failed to search by timestamp:', error);
    throw error;
  }
});

// Get audio memories by topic
audioRoutes.get('/:id/topic/:topic', async (c) => {
  const audioFileId = c.req.param('id');
  const topic = c.req.param('topic');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const memoryService = new EnhancedMemoryService(dbService, c.env.VECTORIZE, c.env.AI, c.env.GEMINI_API_KEY);
  
  try {
    const memories = await memoryService.getAudioMemoriesByTopic(userId, audioFileId, topic);
    
    return c.json({
      success: true,
      audioFileId,
      topic,
      memories: memories.map(memory => ({
        id: memory.id,
        content: memory.content,
        startTime: memory.metadata.startTime,
        endTime: memory.metadata.endTime,
        summary: memory.metadata.summary,
        keyPoints: memory.metadata.keyPoints,
        confidence: memory.metadata.confidence
      }))
    });
  } catch (error) {
    console.error('Failed to get memories by topic:', error);
    throw error;
  }
});

// Flashcards routes
const flashcardsRoutes = new Hono();

flashcardsRoutes.get('/', async (c) => {
  const courseId = c.req.query('courseId');
  
  // TODO: Get flashcards from D1
  return c.json({
    message: 'Get flashcards endpoint - coming soon',
    courseId,
    flashcards: []
  });
});

flashcardsRoutes.post('/', async (c) => {
  try {
    const { courseId, front, back, tags } = await c.req.json();
    
    if (!courseId || !front || !back) {
      createError('Course ID, front, and back are required', 400);
    }

    // TODO: Create flashcard in D1 with FSRS state
    return c.json({
      message: 'Create flashcard endpoint - coming soon',
      flashcard: { courseId, front, back, tags }
    }, 201);
  } catch (error) {
    throw error;
  }
});

flashcardsRoutes.put('/:id/review', async (c) => {
  const id = c.req.param('id');
  const { rating } = await c.req.json();
  
  // TODO: Update FSRS algorithm state based on review
  return c.json({
    message: 'Review flashcard endpoint - coming soon',
    flashcardId: id,
    rating
  });
});

flashcardsRoutes.get('/due', async (c) => {
  // TODO: Get flashcards due for review using FSRS algorithm
  return c.json({
    message: 'Get due flashcards endpoint - coming soon',
    flashcards: []
  });
});

// Mount protected routes (after auth middleware)
apiRoutes.route('/courses', coursesRoutes);
apiRoutes.route('/documents', documentsRoutes);
apiRoutes.route('/memories', memoryRoutes);
apiRoutes.route('/audio', audioRoutes);
apiRoutes.route('/chat', chatRoutes);
apiRoutes.route('/search', searchRoutes);
apiRoutes.route('/assignments', assignmentsRoutes);
apiRoutes.route('/flashcards', flashcardsRoutes);