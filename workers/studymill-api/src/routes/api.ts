import { Hono } from 'hono';
import { createError } from '../middleware/error';
import { authMiddleware } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { CourseService } from '../services/course';
import { DocumentService } from '../services/document';
import { DocumentProcessorService } from '../services/documentProcessor';
import { VectorService } from '../services/vector';
import { SemanticSearchService } from '../services/semanticSearch';

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

// Apply authentication middleware to all other API routes
apiRoutes.use('*', authMiddleware);

// Courses routes
const coursesRoutes = new Hono();

coursesRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const courseService = new CourseService(dbService);
  
  const courses = await courseService.getUserCourses(userId);
  
  return c.json({
    success: true,
    courses
  });
});

coursesRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const { name, description } = await c.req.json();
  
  const dbService = new DatabaseService(c.env.DB);
  const courseService = new CourseService(dbService);
  
  const course = await courseService.createCourse(userId, { name, description });
  
  return c.json({
    success: true,
    course
  }, 201);
});

coursesRoutes.get('/:id', async (c) => {
  const courseId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const courseService = new CourseService(dbService);
  
  const course = await courseService.getCourse(courseId, userId);
  
  return c.json({
    success: true,
    course
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
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  const processorService = new DocumentProcessorService(
    dbService, 
    documentService, 
    c.env.BUCKET,
    c.env.VECTORIZE,
    c.env.PARSE_EXTRACT_API_KEY,
    c.env.GEMINI_API_KEY
  );
  
  const job = await processorService.queueDocumentProcessing(documentId, userId);
  
  return c.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      progress: job.progress
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
    c.env.GEMINI_API_KEY
  );
  
  const content = await processorService.getProcessedContent(documentId, userId);
  
  return c.json({
    success: true,
    content
  });
});

documentsRoutes.get('/search', async (c) => {
  const userId = c.get('userId');
  const query = c.req.query('q');
  const courseId = c.req.query('courseId');
  const limit = parseInt(c.req.query('limit') || '10');
  
  if (!query) {
    createError('Search query is required', 400, { field: 'q' });
  }
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  const processorService = new DocumentProcessorService(
    dbService, 
    documentService, 
    c.env.BUCKET,
    c.env.VECTORIZE,
    c.env.PARSE_EXTRACT_API_KEY,
    c.env.GEMINI_API_KEY
  );
  
  const results = await processorService.searchDocuments(userId, query, courseId, limit);
  
  return c.json({
    success: true,
    results
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
    c.env.GEMINI_API_KEY
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
    c.env.GEMINI_API_KEY
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
    c.env.GEMINI_API_KEY
  );
  
  const result = await processorService.reindexDocument(documentId, userId);
  
  return c.json({
    success: true,
    indexingStats: result
  }, 202);
});

// Chat routes
const chatRoutes = new Hono();

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

// Search routes
const searchRoutes = new Hono();

// Semantic search endpoint
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
      c.env.GEMINI_API_KEY,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    // Perform search
    const results = await searchService.search(query, {
      topK,
      searchType,
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

// Quick search endpoint (for autocomplete/instant search)
searchRoutes.get('/quick', async (c) => {
  try {
    const userId = c.get('userId');
    const query = c.req.query('q');
    const courseId = c.req.query('courseId');
    const limit = parseInt(c.req.query('limit') || '5');

    if (!query || query.length < 2) {
      return c.json({
        success: true,
        results: [],
        totalResults: 0,
        searchTime: 0,
        searchType: 'quick',
        query: query || ''
      });
    }

    // Initialize services for keyword-only quick search
    const dbService = new DatabaseService(c.env.DB);
    const vectorService = new VectorService(
      c.env.GEMINI_API_KEY,
      c.env.VECTORIZE,
      dbService
    );
    const searchService = new SemanticSearchService(vectorService, dbService);

    // Perform keyword search only for speed
    const results = await searchService.search(query, {
      topK: limit,
      searchType: 'keyword',
      filters: courseId ? { courseId } : {},
      includeMetadata: false,
      userId
    });

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
      c.env.GEMINI_API_KEY,
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
      c.env.GEMINI_API_KEY,
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
apiRoutes.route('/chat', chatRoutes);
apiRoutes.route('/search', searchRoutes);
apiRoutes.route('/assignments', assignmentsRoutes);
apiRoutes.route('/flashcards', flashcardsRoutes);