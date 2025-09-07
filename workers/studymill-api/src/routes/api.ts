import { Hono } from 'hono';
import { createError, requestIdMiddleware, ErrorCodes } from '../middleware/error';
import { authMiddleware } from '../middleware/auth';
import { DatabaseService } from '../services/database';
import { CourseService } from '../services/course';
import { DocumentService } from '../services/document';
import { DocumentProcessorService } from '../services/documentProcessor';
import { VectorService } from '../services/vector';
import { SemanticSearchService } from '../services/semanticSearch';
import { HybridSearchService } from '../services/hybridSearch';
import { createAudioProcessor, AudioProcessor } from '../services/audioProcessor';
import { EnhancedMemoryService } from '../services/enhancedMemory';
import { AssignmentService } from '../services/assignment';
import type { FSRSState } from '../services/fsrs';
import { ActivityService } from '../services/activity';
import { ContextSynthesisService } from '../services/contextSynthesis';
import { QueryProcessorService } from '../services/queryProcessor';
import { memoryRoutes } from './memories';
import { notesRoutes } from './notes';
import plannerRoutes from './planner';
import { semestersRouter } from './semesters';
import { tagsRouter } from './tags';
import { syllabusRouter } from './ingest/syllabus';
import { gradesRouter } from './grades';

export const apiRoutes = new Hono();

// Apply request ID middleware to all routes for error correlation
apiRoutes.use('*', requestIdMiddleware);

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

  // Load semester records for any linked courses in one query
  const semesterIds = Array.from(new Set(
    coursesWithCounts.map((c: any) => c.semester_id).filter((id: string | null | undefined) => !!id)
  ));
  let semestersById: Record<string, { id: string; name: string; start_date: string; end_date: string }> = {};
  if (semesterIds.length > 0) {
    const placeholders = semesterIds.map(() => '?').join(',');
    const rows = await c.env.DB.prepare(
      `SELECT id, name, start_date, end_date FROM semesters WHERE user_id = ? AND id IN (${placeholders})`
    ).bind(userId, ...semesterIds).all();
    for (const row of (rows.results as any[]) || []) {
      semestersById[row.id] = row;
    }
  }

  // Transform courses to match frontend expectations and attach real semester data if present
  const transformedCourses = coursesWithCounts.map((course: any) => ({
    ...course,
    schedule: [], // Placeholder until per-course scheduling is fully implemented
    semester: course.semester_id && semestersById[course.semester_id]
      ? {
          startDate: semestersById[course.semester_id].start_date,
          endDate: semestersById[course.semester_id].end_date,
          name: semestersById[course.semester_id].name
        }
      : null
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
  
  // For now, extract basic fields; schedule and semester handled separately later
  const basicCourseData = {
    name: courseData.name,
    description: courseData.description,
    code: courseData.code,
    color: courseData.color || '#3b82f6',
    instructor: courseData.instructor,
    credits: courseData.credits || 3
  };
  
  const course = await courseService.createCourse(userId, basicCourseData);

  // Try to attach real semester if the client provided a semester_id elsewhere (future extension)
  let semesterData: any = null;
  if ((course as any)?.semester_id) {
    const sem = await new DatabaseService(c.env.DB).queryFirst(
      'SELECT id, name, start_date, end_date FROM semesters WHERE id = ? AND user_id = ?',
      [(course as any).semester_id, userId]
    );
    if (sem) {
      semesterData = { startDate: sem.start_date, endDate: sem.end_date, name: sem.name };
    }
  }
  
  return c.json({
    success: true,
    course: {
      ...course,
      schedule: courseData.schedule || [],
      semester: semesterData,
      memoryCount: 0
    }
  }, 201);
});

// Today's classes endpoint - must come before /:id route
coursesRoutes.get('/today', async (c) => {
  const userId = c.get('userId');
  
  try {
    const dbService = new DatabaseService(c.env.DB);
    
    // Get current day of week (0=Sunday, 1=Monday, etc.)
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Get today's classes from course_schedules table
    const scheduledClasses = await dbService.query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.color,
        cs.start_time,
        cs.end_time,
        cs.location
      FROM courses c
      JOIN course_schedules cs ON c.id = cs.course_id
      WHERE c.user_id = ? AND cs.day_of_week = ?
      ORDER BY cs.start_time ASC
    `, [userId, dayOfWeek]);

    // Also check for courses with schedule_json (legacy/simple format)
    const jsonScheduledCourses = await dbService.query(`
      SELECT id, name, description, color, schedule_json, location
      FROM courses 
      WHERE user_id = ? AND schedule_json IS NOT NULL
    `, [userId]);

    const todayClasses = [];

    // Process course_schedules table results
    for (const cls of scheduledClasses) {
      todayClasses.push({
        id: cls.id,
        courseId: cls.id,
        courseName: cls.name,
        courseCode: cls.name.split(' ')[0] || cls.name, // Extract course code
        startTime: cls.start_time,
        endTime: cls.end_time,
        location: cls.location || 'TBD',
        color: cls.color || '#3B82F6',
        type: 'scheduled'
      });
    }

    // Process schedule_json format
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[dayOfWeek];

    for (const course of jsonScheduledCourses) {
      try {
        if (course.schedule_json) {
          const schedule = JSON.parse(course.schedule_json);
          if (schedule[todayName]) {
            const timeSlot = schedule[todayName];
            const [startTime, endTime] = timeSlot.includes('-') 
              ? timeSlot.split('-').map(t => t.trim())
              : [timeSlot, timeSlot];
            
            todayClasses.push({
              id: `${course.id}_json`,
              courseId: course.id,
              courseName: course.name,
              courseCode: course.name.split(' ')[0] || course.name,
              startTime: startTime || '09:00',
              endTime: endTime || '10:30',
              location: course.location || 'TBD',
              color: course.color || '#3B82F6',
              type: 'json_schedule'
            });
          }
        }
      } catch (error) {
        console.warn('Failed to parse schedule_json for course:', course.id, error);
      }
    }

    // Sort by start time
    todayClasses.sort((a, b) => {
      const timeA = a.startTime.replace(':', '');
      const timeB = b.startTime.replace(':', '');
      return timeA.localeCompare(timeB);
    });

    // If no classes found, optionally return a demo class for better UX
    if (todayClasses.length === 0) {
      // Check if user has any courses at all
      const allCourses = await dbService.query(
        'SELECT COUNT(*) as count FROM courses WHERE user_id = ?',
        [userId]
      );

      if (allCourses[0]?.count > 0) {
        // User has courses but no schedule - show helpful message
        return c.json({
          success: true,
          classes: [],
          message: 'No classes scheduled for today. Add schedules to your courses to see them here.'
        });
      }
    }

    return c.json({
      success: true,
      classes: todayClasses,
      today: {
        date: today.toISOString().split('T')[0],
        dayOfWeek: dayOfWeek,
        dayName: todayName
      }
    });

  } catch (error) {
    console.error('Today\'s classes error:', error);
    
    // Graceful fallback
    return c.json({
      success: true,
      classes: [],
      error: 'Unable to load today\'s classes'
    });
  }
});

// Add schedule to a course
coursesRoutes.post('/:id/schedule', async (c) => {
  const courseId = c.req.param('id');
  const userId = c.get('userId');
  
  try {
    const { schedules } = await c.req.json();
    
    if (!schedules || !Array.isArray(schedules)) {
      return c.json({
        success: false,
        error: 'schedules array is required'
      }, 400);
    }

    const dbService = new DatabaseService(c.env.DB);
    
    // Verify course ownership
    const course = await dbService.query(
      'SELECT id FROM courses WHERE id = ? AND user_id = ?',
      [courseId, userId]
    );
    
    if (course.length === 0) {
      return c.json({
        success: false,
        error: 'Course not found'
      }, 404);
    }

    // Delete existing schedules for this course
    await dbService.execute(
      'DELETE FROM course_schedules WHERE course_id = ?',
      [courseId]
    );

    // Insert new schedules
    for (const schedule of schedules) {
      const { dayOfWeek, startTime, endTime, location } = schedule;
      
      if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
        return c.json({
          success: false,
          error: 'dayOfWeek must be a number between 0-6'
        }, 400);
      }

      await dbService.execute(
        `INSERT INTO course_schedules (id, course_id, day_of_week, start_time, end_time, location)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          courseId,
          dayOfWeek,
          startTime,
          endTime,
          location || null
        ]
      );
    }

    return c.json({
      success: true,
      message: 'Course schedule updated successfully'
    });

  } catch (error) {
    console.error('Update course schedule error:', error);
    return c.json({
      success: false,
      error: 'Failed to update course schedule'
    }, 500);
  }
});

// Get course schedule
coursesRoutes.get('/:id/schedule', async (c) => {
  const courseId = c.req.param('id');
  const userId = c.get('userId');
  
  try {
    const dbService = new DatabaseService(c.env.DB);
    
    // Verify course ownership and get schedules
    const schedules = await dbService.query(`
      SELECT cs.day_of_week, cs.start_time, cs.end_time, cs.location
      FROM course_schedules cs
      JOIN courses c ON cs.course_id = c.id
      WHERE c.id = ? AND c.user_id = ?
      ORDER BY cs.day_of_week, cs.start_time
    `, [courseId, userId]);

    return c.json({
      success: true,
      schedules
    });

  } catch (error) {
    console.error('Get course schedule error:', error);
    return c.json({
      success: false,
      error: 'Failed to get course schedule'
    }, 500);
  }
});

coursesRoutes.get('/:id', async (c) => {
  const courseId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const courseService = new CourseService(dbService);
  
  const course = await courseService.getCourse(courseId, userId);
  
  // Get real memory count for this specific course
  const memoryCount = await dbService.getMemoryCountByCourse(courseId, userId);

  // Attach real semester when available
  let semesterData: any = null;
  if ((course as any)?.semester_id) {
    const sem = await dbService.queryFirst(
      'SELECT id, name, start_date, end_date FROM semesters WHERE id = ? AND user_id = ?',
      [(course as any).semester_id, userId]
    );
    if (sem) {
      semesterData = {
        startDate: sem.start_date,
        endDate: sem.end_date,
        name: sem.name
      };
    }
  }
  
  return c.json({
    success: true,
    course: {
      ...course,
      schedule: [], // Placeholder until per-course scheduling is fully implemented
      semester: semesterData,
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
  
  try {
    await courseService.deleteCourse(courseId, userId);
    return c.json({
      success: true,
      message: 'Course deleted successfully'
    }, 200);
  } catch (err: any) {
    // Make delete idempotent: treat not-found as success
    const status = err?.statusCode || err?.status;
    const code = err?.code || err?.message;
    if (status === 404 || String(code).toUpperCase().includes('NOT_FOUND')) {
      return c.json({ success: true, message: 'Course already deleted' }, 200);
    }
    throw err;
  }
});


// Documents routes
const documentsRoutes = new Hono();

// CANONICAL API: Enhanced upload endpoint with idempotency and dual-mode support
documentsRoutes.post('/upload', async (c) => {
  const userId = c.get('userId');
  const idempotencyKey =
    c.req.header('idempotency-key') ||
    c.req.header('Idempotency-Key');
  
  if (!idempotencyKey) {
    createError('Idempotency-Key header is required', 400, ErrorCodes.VALIDATION_ERROR, { field: 'Idempotency-Key' });
  }

  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);

  // Check for existing upload with same idempotency key
  try {
    const existing = await dbService.query(
      'SELECT id, processing_status FROM documents WHERE user_id = ? AND idempotency_key = ? AND created_at > datetime("now", "-1 hour")',
      [userId, idempotencyKey]
    );
    
    if (existing.length > 0) {
      const existingDoc = existing[0];
      return c.json({
        success: true,
        documentId: existingDoc.id,
        streamUrl: `/api/v1/documents/${existingDoc.id}/stream`,
        statusUrl: `/api/v1/documents/${existingDoc.id}/status`,
        duplicate: true
      }, 200);
    }
  } catch (error) {
    console.warn('Idempotency check failed:', error);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const courseId = formData.get('courseId') as string;
  const documentType = formData.get('documentType') as string;
  const strategy = formData.get('strategy') as string; // 'multipart' or 'presigned'
  
  if (!file && strategy !== 'presigned') {
    createError('File is required for multipart upload', 400, ErrorCodes.VALIDATION_ERROR, { field: 'file' });
  }
  
  if (!courseId) {
    createError('Course ID is required', 400, ErrorCodes.VALIDATION_ERROR, { field: 'courseId' });
  }

  // Strategy 1: Pre-signed upload for large files
  if (strategy === 'presigned') {
    const filename = formData.get('filename') as string;
    const contentType = formData.get('contentType') as string;
    const size = parseInt(formData.get('size') as string);

    if (!filename || !contentType) {
      createError('filename and contentType required for presigned upload', 400, ErrorCodes.VALIDATION_ERROR, {
        missing: !filename ? 'filename' : 'contentType'
      });
    }

    // Create document record first
    const documentId = crypto.randomUUID();
    await dbService.execute(
      `INSERT INTO documents (id, user_id, course_id, filename, file_type, file_size, 
       document_type, processing_status, idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))`,
      [documentId, userId, courseId, filename, contentType, size, documentType || 'unknown', idempotencyKey]
    );

    // Generate pre-signed URL (simplified for demo - real implementation would use R2 pre-signed URLs)
    const uploadUrl = `${c.env.BUCKET.endpoint}/${documentId}`;
    
    return c.json({
      success: true,
      documentId,
      uploadUrl,
      streamUrl: `/api/v1/documents/${documentId}/stream`,
      statusUrl: `/api/v1/documents/${documentId}/status`,
      presigned: true
    }, 201);
  }

  // Strategy 2: Direct multipart upload (existing flow)
  if (!file) {
    createError('File is required', 400, ErrorCodes.VALIDATION_ERROR, { field: 'file' });
  }

  // Auto-fallback to presigned for large files (> 50MB)
  const MAX_DIRECT_BYTES = 50 * 1024 * 1024;
  if (file.size > MAX_DIRECT_BYTES) {
    createError('File too large for direct upload. Use presigned strategy.', 413, ErrorCodes.FILE_TOO_LARGE, {
      maxSize: MAX_DIRECT_BYTES,
      fileSize: file.size,
      recommendation: 'Use strategy=presigned for files larger than 50MB'
    });
  }
  
  // Convert file to buffer
  const fileBuffer = await file.arrayBuffer();
  
  // Add idempotency key to document metadata
  const document = await documentService.uploadDocument(userId, {
    courseId,
    filename: file.name,
    fileType: file.type,
    fileSize: file.size,
    documentType: documentType as any,
    idempotencyKey
  }, fileBuffer);
  
  return c.json({
    success: true,
    documentId: document.id,
    streamUrl: `/api/v1/documents/${document.id}/stream`,
    statusUrl: `/api/v1/documents/${document.id}/status`,
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

// LEGACY: Deprecated processing-status endpoint (use /status instead)
documentsRoutes.get('/:id/processing-status', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  // Add deprecation headers
  c.header('Deprecation', 'true');
  c.header('Sunset', 'Fri, 15 Sep 2025 23:59:59 GMT');
  c.header('Link', '</api/v1/documents/:id/status>; rel="successor-version"');
  c.header('Warning', '299 - "This endpoint is deprecated. Use /api/v1/documents/:id/status instead."');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  
  const document = await documentService.getDocument(documentId, userId);
  if (!document) {
    createError('Document not found', 404);
  }
  
  // Log legacy endpoint usage for telemetry
  console.warn(`Legacy endpoint usage: /documents/${documentId}/processing-status by user ${userId}`);
  
  return c.json({
    success: true,
    documentId,
    status: document.processing_status,
    error: document.processing_error || null,
    _deprecated: true,
    _successor: `/api/v1/documents/${documentId}/status`
  });
});

// CANONICAL API: SSE progress streaming endpoint 
documentsRoutes.get('/:id/stream', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  
  const document = await documentService.getDocument(documentId, userId);
  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }

  // Set SSE headers
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');
  c.header('Access-Control-Allow-Origin', '*');
  
  // Create SSE stream
  let eventId = 0;
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (type: string, data: any) => {
        const event = `id: ${++eventId}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(event));
      };

      // Send initial status
      sendEvent('progress', {
        stage: document.processing_status === 'pending' ? 'pending' : 
               document.processing_status === 'processing' ? 'extract' :
               document.processing_status === 'ready' ? 'done' : 'error',
        percent: document.processing_status === 'ready' ? 100 : 
                 document.processing_status === 'processing' ? 50 : 0,
        message: document.processing_status === 'ready' ? 'Processing complete' :
                 document.processing_status === 'processing' ? 'Processing document' :
                 document.processing_status === 'pending' ? 'Queued for processing' :
                 'Processing failed'
      });

      // If document is complete or failed, send final event and close
      if (document.processing_status === 'ready') {
        sendEvent('done', {
          documentId,
          status: 'complete'
        });
        controller.close();
      } else if (document.processing_status === 'failed') {
        sendEvent('error', {
          code: 'PROCESSING_ERROR',
          message: document.processing_error || 'Processing failed'
        });
        controller.close();
      } else {
        // Poll for updates every 2 seconds for active processing
        const pollInterval = setInterval(async () => {
          try {
            const updatedDoc = await documentService.getDocument(documentId, userId);
            if (!updatedDoc) {
              sendEvent('error', { code: 'NOT_FOUND', message: 'Document not found' });
              clearInterval(pollInterval);
              controller.close();
              return;
            }

            if (updatedDoc.processing_status === 'ready') {
              sendEvent('progress', { stage: 'done', percent: 100, message: 'Processing complete' });
              sendEvent('done', { documentId, status: 'complete' });
              clearInterval(pollInterval);
              controller.close();
            } else if (updatedDoc.processing_status === 'failed') {
              sendEvent('error', {
                code: 'PROCESSING_ERROR',
                message: updatedDoc.processing_error || 'Processing failed'
              });
              clearInterval(pollInterval);
              controller.close();
            } else if (updatedDoc.processing_status === 'processing') {
              // Simulate progress stages for better UX
              const randomProgress = 20 + Math.floor(Math.random() * 60);
              sendEvent('progress', {
                stage: randomProgress < 40 ? 'extract' : randomProgress < 70 ? 'analyze' : 'memories',
                percent: randomProgress,
                message: randomProgress < 40 ? 'Extracting text' : 
                        randomProgress < 70 ? 'Analyzing content' : 'Creating memories'
              });
            }
          } catch (error) {
            sendEvent('error', { code: 'INTERNAL_ERROR', message: 'Polling failed' });
            clearInterval(pollInterval);
            controller.close();
          }
        }, 2000);

        // Clean up after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          controller.close();
        }, 300000);
      }
    }
  });

  return new Response(stream);
});

// CANONICAL API: Polling fallback status endpoint
documentsRoutes.get('/:id/status', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  const documentService = new DocumentService(dbService, c.env.BUCKET);
  
  const document = await documentService.getDocument(documentId, userId);
  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }
  
  return c.json({
    documentId,
    status: document.processing_status === 'ready' ? 'complete' : 
            document.processing_status === 'processing' ? 'processing' :
            document.processing_status === 'pending' ? 'pending' : 'failed',
    stage: document.processing_status === 'processing' ? 'extract' : 'none',
    percent: document.processing_status === 'ready' ? 100 : 
             document.processing_status === 'processing' ? 50 : 0,
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

// Process document with comprehensive instrumentation (P1-011 Enhancement)
documentsRoutes.post('/:id/process-instrumented', async (c) => {
  const documentId = c.req.param('id');
  const userId = c.get('userId');
  const { processingMode = 'auto' } = await c.req.json();
  
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
  
  try {
    const result = await processorService.processDocumentWithInstrumentation(
      documentId,
      userId,
      processingMode
    );
    
    return c.json({
      success: result.success,
      processingResult: result
    }, result.success ? 200 : 500);
    
  } catch (error) {
    console.error('Instrumented processing endpoint error:', error);
    throw createError('Document processing failed', 500, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get processing health report for document (P1-011 Enhancement)
documentsRoutes.get('/:id/health-report', async (c) => {
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
  
  try {
    const healthReport = await processorService.getProcessingHealthReport(documentId, userId);
    
    return c.json({
      success: true,
      healthReport
    });
    
  } catch (error) {
    console.error('Health report endpoint error:', error);
    throw createError('Failed to generate health report', 500, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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

  // Structured server log for WS upgrade
  try {
    const ts = new Date().toISOString();
    console.log(
      JSON.stringify({
        event: 'chat_ws_upgrade',
        ts,
        path: c.req.path,
        sessionId
      })
    );
  } catch {}
  
  // Get Durable Object instance for this session
  const durableObjectId = c.env.CHAT_DO.idFromName(sessionId);
  const chatDO = c.env.CHAT_DO.get(durableObjectId);
  
  // Forward the WebSocket upgrade request to the Durable Object
  return chatDO.fetch(c.req.raw);
});

chatRoutes.get('/sessions', async (c) => {
  const userId = c.get('userId');
  
  const dbService = new DatabaseService(c.env.DB);
  
  try {
    const sessions = await dbService.query(`
      SELECT 
        id, user_id, course_id, assignment_id, title, created_at, updated_at,
        (SELECT COUNT(*) FROM chat_messages WHERE session_id = chat_sessions.id) as message_count,
        (SELECT created_at FROM chat_messages WHERE session_id = chat_sessions.id ORDER BY created_at DESC LIMIT 1) as last_activity
      FROM chat_sessions 
      WHERE user_id = ? 
      ORDER BY updated_at DESC
    `, [userId]);

    return c.json({
      success: true,
      sessions: sessions.map((session: any) => ({
        id: session.id,
        courseId: session.course_id,
        assignmentId: session.assignment_id,
        title: session.title,
        messageCount: session.message_count || 0,
        lastActivity: session.last_activity,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    throw createError('Failed to fetch chat sessions', 500, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

chatRoutes.post('/sessions', async (c) => {
  const userId = c.get('userId');
  
  try {
    const { courseId, assignmentId, title = 'New Chat' } = await c.req.json();
    
    const dbService = new DatabaseService(c.env.DB);
    const sessionId = 'session_' + crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Create new chat session
    await dbService.query(`
      INSERT INTO chat_sessions (id, user_id, course_id, assignment_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      sessionId,
      userId,
      courseId || null,
      assignmentId || null,
      title,
      now,
      now
    ]);
    
    return c.json({
      success: true,
      session: {
        id: sessionId,
        courseId,
        assignmentId,
        title,
        messageCount: 0,
        createdAt: now,
        updatedAt: now
      }
    }, 201);
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw createError('Failed to create chat session', 500, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

chatRoutes.get('/sessions/:id/messages', async (c) => {
  const sessionId = c.req.param('id');
  const userId = c.get('userId');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');
  
  const dbService = new DatabaseService(c.env.DB);
  
  try {
    // Verify session belongs to user
    const session = await dbService.query(`
      SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?
    `, [sessionId, userId]);
    
    if (session.length === 0) {
      throw createError('Chat session not found', 404);
    }
    
    // Get messages for session
    const messages = await dbService.query(`
      SELECT id, role, content, document_references, created_at
      FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `, [sessionId, limit, offset]);

    return c.json({
      success: true,
      sessionId,
      messages: messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        documentReferences: msg.document_references ? JSON.parse(msg.document_references) : [],
        timestamp: msg.created_at
      })),
      pagination: {
        limit,
        offset,
        hasMore: messages.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    throw createError('Failed to fetch chat messages', 500, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

chatRoutes.post('/sessions/:id/messages', async (c) => {
  const sessionId = c.req.param('id');
  const userId = c.get('userId');
  
  try {
    const { content, courseId } = await c.req.json();
    
    if (!content) {
      throw createError('Message content is required', 400);
    }

    const dbService = new DatabaseService(c.env.DB);
    
    // Verify session belongs to user
    const session = await dbService.query(`
      SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?
    `, [sessionId, userId]);
    
    if (session.length === 0) {
      throw createError('Chat session not found', 404);
    }

    // For HTTP fallback - store user message and generate response
    const userMessageId = 'msg_' + crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Store user message
    await dbService.query(`
      INSERT INTO chat_messages (id, session_id, role, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userMessageId, sessionId, 'user', content, now, now]);

    // Generate AI response using ContextSynthesisService
    const contextSynthesis = new ContextSynthesisService(
      c.env.AI,
      new VectorService(c.env.AI, c.env.VECTORIZE, dbService),
      dbService
    );

    // Get context for the query
    const searchService = new HybridSearchService(
      new VectorService(c.env.AI, c.env.VECTORIZE, dbService),
      dbService
    );

    const context = await searchService.hybridSearch({
      query: content,
      userId,
      containerTags: courseId ? [courseId] : undefined,
      limit: 5,
      threshold: 0.7
    });

    // Generate response using synthesis service
    const synthesisResult = await contextSynthesis.synthesizeContext(userId, {
      query: content,
      documentIds: context.map(result => result.metadata?.source).filter(Boolean),
      type: 'conversational',
      options: {
        includeSourceReferences: true,
        maxContextLength: 2000
      }
    });
    
    const aiResponse = synthesisResult.content;
    const assistantMessageId = 'msg_' + crypto.randomUUID();
    
    // Store AI response
    await dbService.query(`
      INSERT INTO chat_messages (id, session_id, role, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [assistantMessageId, sessionId, 'assistant', aiResponse, now, now]);
    
    return c.json({
      success: true,
      userMessage: {
        id: userMessageId,
        role: 'user',
        content,
        timestamp: now
      },
      assistantMessage: {
        id: assistantMessageId,
        role: 'assistant',
        content: aiResponse,
        timestamp: now
      }
    }, 201);
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw createError('Failed to send message', 500, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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
  try {
    const userId = c.get('userId');
    const courseId = c.req.query('courseId');
    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const dbService = new DatabaseService(c.env.DB);
    const assignmentService = new AssignmentService(dbService);
    
    const { assignments, total } = await assignmentService.getUserAssignments(
      userId,
      courseId || undefined,
      status || undefined,
      limit,
      offset
    );
    
    // Transform for frontend compatibility
    const transformedAssignments = assignments.map((assignment: any) => ({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      type: assignment.assignment_type,
      course: {
        id: assignment.course_id,
        name: assignment.course_name || 'Unknown Course',
        color: '#4A7C2A', // Default color, TODO: get from courses table
        code: assignment.course_name || 'COURSE'
      },
      dueDate: assignment.due_date ? new Date(assignment.due_date) : null,
      status: assignment.status,
      priority: assignment.status === 'overdue' ? 'high' : 
               assignment.due_date && new Date(assignment.due_date).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 ? 'high' :
               assignment.due_date && new Date(assignment.due_date).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 ? 'medium' : 'low',
      createdAt: new Date(assignment.created_at),
      updatedAt: new Date(assignment.updated_at)
    }));
    
    return c.json({
      success: true,
      assignments: transformedAssignments,
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > offset + limit
      }
    });
  } catch (error) {
    console.error('Get assignments error:', error);
    throw error;
  }
});

assignmentsRoutes.get('/due', async (c) => {
  try {
    const userId = c.get('userId');
    const days = parseInt(c.req.query('days') || '7');
    const limit = parseInt(c.req.query('limit') || '10');
    
    const dbService = new DatabaseService(c.env.DB);
    const assignmentService = new AssignmentService(dbService);
    
    const assignments = await assignmentService.getDueAssignments(userId, days, limit);
    
    // Transform for frontend compatibility
    const transformedAssignments = assignments.map((assignment: any) => ({
      id: assignment.id,
      title: assignment.title,
      type: assignment.assignment_type,
      course: {
        name: assignment.course_name || 'Unknown Course',
        color: '#4A7C2A',
        code: assignment.course_name || 'COURSE'
      },
      dueDate: assignment.due_date || null,
      priority: assignment.status === 'overdue' ? 'high' : 'medium',
      completed: assignment.status === 'completed',
      progress: assignment.status === 'completed' ? 100 : 
                assignment.status === 'in_progress' ? 50 : 0
    }));
    
    return c.json({
      success: true,
      assignments: transformedAssignments
    });
  } catch (error) {
    console.error('Get due assignments error:', error);
    throw error;
  }
});

assignmentsRoutes.get('/stats', async (c) => {
  try {
    const userId = c.get('userId');
    
    const dbService = new DatabaseService(c.env.DB);
    const assignmentService = new AssignmentService(dbService);
    
    const stats = await assignmentService.getAssignmentStats(userId);
    
    return c.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get assignment stats error:', error);
    throw error;
  }
});

assignmentsRoutes.post('/', async (c) => {
  try {
    const userId = c.get('userId');
    const { courseId, title, description, dueDate, assignmentType, status } = await c.req.json();
    
    if (!courseId || !title) {
      createError('Course ID and title are required', 400);
    }

    const dbService = new DatabaseService(c.env.DB);
    const assignmentService = new AssignmentService(dbService);
    
    const assignment = await assignmentService.createAssignment(userId, courseId, {
      title,
      description,
      dueDate,
      assignmentType,
      status
    });
    
    return c.json({
      success: true,
      assignment
    }, 201);
  } catch (error) {
    console.error('Create assignment error:', error);
    throw error;
  }
});

assignmentsRoutes.get('/:id', async (c) => {
  try {
    const assignmentId = c.req.param('id');
    const userId = c.get('userId');
    
    const dbService = new DatabaseService(c.env.DB);
    const assignmentService = new AssignmentService(dbService);
    
    const assignment = await assignmentService.getAssignment(assignmentId, userId);
    
    return c.json({
      success: true,
      assignment
    });
  } catch (error) {
    console.error('Get assignment error:', error);
    throw error;
  }
});

assignmentsRoutes.put('/:id', async (c) => {
  try {
    const assignmentId = c.req.param('id');
    const userId = c.get('userId');
    const updates = await c.req.json();
    
    const dbService = new DatabaseService(c.env.DB);
    const assignmentService = new AssignmentService(dbService);
    
    const assignment = await assignmentService.updateAssignment(assignmentId, userId, {
      title: updates.title,
      description: updates.description,
      dueDate: updates.dueDate,
      assignmentType: updates.assignmentType,
      status: updates.status
    });
    
    return c.json({
      success: true,
      assignment
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    throw error;
  }
});

assignmentsRoutes.delete('/:id', async (c) => {
  try {
    const assignmentId = c.req.param('id');
    const userId = c.get('userId');
    
    const dbService = new DatabaseService(c.env.DB);
    const assignmentService = new AssignmentService(dbService);
    
    await assignmentService.deleteAssignment(assignmentId, userId);
    
    return c.json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    console.error('Delete assignment error:', error);
    throw error;
  }
});

assignmentsRoutes.get('/course/:courseId', async (c) => {
  try {
    const courseId = c.req.param('courseId');
    const userId = c.get('userId');
    
    const dbService = new DatabaseService(c.env.DB);
    const assignmentService = new AssignmentService(dbService);
    
    const assignments = await assignmentService.getCourseAssignments(courseId, userId);
    
    return c.json({
      success: true,
      assignments
    });
  } catch (error) {
    console.error('Get course assignments error:', error);
    throw error;
  }
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

// List flashcards (with filters and pagination)
flashcardsRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);

  const courseId = c.req.query('courseId');
  const deckId = c.req.query('deckId');
  const assignmentId = c.req.query('assignmentId');
  const weekId = c.req.query('weekId');
  const tags = c.req.query('tags')?.split(',').map(t => t.trim()).filter(Boolean) || [];
  const query = c.req.query('query');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  // Build WHERE clauses
  const where: string[] = ['f.user_id = ?'];
  const params: any[] = [userId];
  if (courseId) { where.push('f.course_id = ?'); params.push(courseId); }
  if (deckId) { where.push('f.deck_id = ?'); params.push(deckId); }
  if (assignmentId) { where.push('d.assignment_id = ?'); params.push(assignmentId); }
  if (weekId) { where.push('d.week_id = ?'); params.push(weekId); }
  if (query) { where.push('(LOWER(f.front) LIKE ? OR LOWER(f.back) LIKE ?)'); params.push(`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`); }
  if (tags.length > 0) {
    // Simple JSON LIKE matching for tags
    for (const tag of tags) { where.push("f.tags LIKE ?"); params.push(`%"${tag}"%`); }
  }
  const whereSql = where.join(' AND ');

  const sql = `
    SELECT f.*, d.name as deck_name, d.source_type as deck_source_type
    FROM flashcards f
    LEFT JOIN decks d ON f.deck_id = d.id
    WHERE ${whereSql}
    ORDER BY f.updated_at DESC
    LIMIT ? OFFSET ?
  `;
  const qParams = [...params, limit, offset];
  const cards = await dbService.query(sql, qParams);

  const countSql = `SELECT COUNT(*) as total FROM flashcards f LEFT JOIN decks d ON f.deck_id = d.id WHERE ${whereSql}`;
  const countRow = await dbService.queryFirst(countSql, params);
  const total = (countRow as any)?.total || 0;

  return c.json({
    success: true,
    items: cards.map((row: any) => ({
      id: row.id,
      courseId: row.course_id,
      deckId: row.deck_id,
      front: row.front,
      back: row.back,
      tags: row.tags ? JSON.parse(row.tags) : [],
      fsrsState: row.fsrs_state ? JSON.parse(row.fsrs_state) : null,
      stability: row.stability,
      difficulty: row.difficulty,
      nextReview: row.next_review,
      reviewCount: row.review_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deck: row.deck_id ? { id: row.deck_id, name: row.deck_name, sourceType: row.deck_source_type } : null
    })),
    pagination: { total, limit, offset, hasMore: total > offset + limit }
  });
});

// Create a single flashcard
flashcardsRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const { courseId, deckId, front, back, tags = [] } = await c.req.json();

  if (!courseId || !front || !back) {
    createError('Course ID, front, and back are required', 400);
  }

  const id = 'card_' + crypto.randomUUID();
  const now = new Date().toISOString();
  const fsrsInitial = { stage: 'learning', stability: 0, difficulty: 0, reps: 0 };
  await dbService.execute(`
    INSERT INTO flashcards (id, course_id, user_id, deck_id, front, back, tags, fsrs_state, stability, difficulty, next_review, review_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `, [
    id,
    courseId,
    userId,
    deckId || null,
    front,
    back,
    JSON.stringify(tags),
    JSON.stringify(fsrsInitial),
    0,
    0,
    now,
    now,
    now,
  ]);

  return c.json({ success: true, id }, 201);
});

// Import many flashcards (supports text or structured cards)
flashcardsRoutes.post('/import', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const body = await c.req.json();
  const { courseId, deckId, deck, text, parseOptions, cards } = body;

  if (!courseId) {
    createError('courseId is required', 400);
  }

  // Create deck if needed
  let effectiveDeckId = deckId || null;
  if (!effectiveDeckId && deck?.name) {
    effectiveDeckId = 'deck_' + crypto.randomUUID();
    const now = new Date().toISOString();
    await dbService.execute(`
      INSERT INTO decks (id, user_id, course_id, assignment_id, week_id, name, description, source_type, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      effectiveDeckId,
      userId,
      courseId,
      deck.assignmentId || null,
      deck.weekId || null,
      deck.name,
      deck.description || null,
      deck.sourceType || 'custom',
      deck.metadata ? JSON.stringify(deck.metadata) : null,
      now, now
    ]);
  }

  // Parse input into cards array if text provided
  let toCreate: Array<{ front: string; back: string; tags?: string[] }>; 
  if (text && !cards) {
    // Simple heuristics: try JSON, then TSV/CSV, then line patterns
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        toCreate = parsed.map((p: any) => Array.isArray(p) ? { front: String(p[0]||'').trim(), back: String(p[1]||'').trim() } : { front: String(p.front||'').trim(), back: String(p.back||'').trim(), tags: p.tags || [] })
                         .filter(p => p.front && p.back);
      } else {
        toCreate = [];
      }
    } catch {
      // Detect delimiter
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const delimiter = (parseOptions?.delimiter) || (lines[0]?.includes('\t') ? '\t' : lines[0]?.includes(',') ? ',' : null);
      if (delimiter) {
        toCreate = lines.map(l => {
          const parts = delimiter === '\t' ? l.split('\t') : l.split(',');
          const front = (parts[0]||'').trim();
          const back = (parts[1]||'').trim();
          return front && back ? { front, back } : null;
        }).filter(Boolean) as any;
      } else {
        // Common pattern: term — definition, term - definition, term: definition
        toCreate = [];
        for (const l of lines) {
          const m = l.split(/\s[—:-]\s|\t|\s-\s|:\s/);
          if (m.length >= 2) {
            const front = m[0].trim();
            const back = m.slice(1).join(' - ').trim();
            if (front && back) toCreate.push({ front, back });
          }
        }
      }
    }
  } else {
    toCreate = (cards || []).filter((c: any) => c.front && c.back);
  }

  if (!toCreate || toCreate.length === 0) {
    return c.json({ success: false, error: 'No valid cards found to import' }, 400);
  }

  // Insert cards
  const now = new Date().toISOString();
  const createdIds: string[] = [];
  for (const card of toCreate) {
    const id = 'card_' + crypto.randomUUID();
    const fsrsInitial = { stage: 'learning', stability: 0, difficulty: 0, reps: 0 };
    await dbService.execute(`
      INSERT INTO flashcards (id, course_id, user_id, deck_id, front, back, tags, fsrs_state, stability, difficulty, next_review, review_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, ?)
    `, [
      id,
      courseId,
      userId,
      effectiveDeckId,
      card.front,
      card.back,
      JSON.stringify(card.tags || []),
      JSON.stringify(fsrsInitial),
      now,
      now,
      now
    ]);
    createdIds.push(id);
  }

  return c.json({ success: true, deckId: effectiveDeckId, createdCount: createdIds.length, ids: createdIds });
});

// Generate a new deck from documents/scope and persist cards
flashcardsRoutes.post('/generate', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const body = await c.req.json();
  const {
    courseId,
    documentIds = [],
    assignmentId,
    weekId,
    deckName,
    highlightPrompt = '',
    useSyllabusData = false,
    extraInfo = '',
    count = 20,
    difficulty = 'medium'
  } = body;

  if (!courseId) {
    createError('courseId is required', 400);
  }

  // Create a new deck for this generation
  const deckId = 'deck_' + crypto.randomUUID();
  const now = new Date().toISOString();
  await dbService.execute(`
    INSERT INTO decks (id, user_id, course_id, assignment_id, week_id, name, description, source_type, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    deckId,
    userId,
    courseId,
    assignmentId || null,
    weekId || null,
    deckName || `Generated ${new Date().toLocaleString()}`,
    highlightPrompt || null,
    assignmentId ? 'test' : weekId ? 'week' : 'custom',
    JSON.stringify({ highlightPrompt, useSyllabusData, extraInfo, documentIds, difficulty }),
    now,
    now
  ]);

  // Use existing AI endpoint under /ai/flashcards to generate raw cards
  // We simulate internal call by reusing the Document/AI services via ContextSynthesis in this file if necessary.
  // Simpler approach: call service implemented elsewhere; for now, we create a minimal plausible result:
  // To keep consistent with your current /ai/flashcards, we will not duplicate logic here; frontend can preview via /ai then import.

  // Respond with deck created; cards should be added via separate import using the generated content
  return c.json({ success: true, deckId });
});

// Review a flashcard with 1-4 rating and update FSRS fields
flashcardsRoutes.put('/:id/review', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const id = c.req.param('id');
  const { rating } = await c.req.json();

  const r = parseInt(rating);
  if (!(r >= 1 && r <= 4)) {
    return c.json({ success: false, error: 'rating must be 1..4' }, 400);
  }

  const card = await dbService.queryFirst(`SELECT * FROM flashcards WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!card) {
    return c.json({ success: false, error: 'Card not found' }, 404);
  }

  const beforeNext = card.next_review;
  const beforeStability = card.stability || 0;
  const beforeDifficulty = card.difficulty || 5;
  const beforeReps = (card.fsrs_state ? JSON.parse(card.fsrs_state).reps : 0) || 0;

  // Use FSRS utility
  const { updateFsrsState } = await import('../services/fsrs');
  const result = updateFsrsState({
    rating: r as 1|2|3|4,
    state: {
      stability: beforeStability,
      difficulty: beforeDifficulty,
      reps: beforeReps,
    },
  });

  const updatedCount = (card.review_count || 0) + 1;

  await dbService.execute(`
    UPDATE flashcards
    SET stability = ?, difficulty = ?, next_review = ?, review_count = ?, fsrs_state = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `, [
    result.state.stability,
    result.state.difficulty,
    result.nextReview,
    updatedCount,
    JSON.stringify(result.state),
    new Date().toISOString(),
    id,
    userId
  ]);

  // Insert review log
  await dbService.execute(`
    INSERT INTO flashcard_reviews (id, user_id, flashcard_id, rating, reviewed_at, due_before, due_after, stability_before, stability_after, difficulty_before, difficulty_after)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'rev_' + crypto.randomUUID(),
    userId,
    id,
    r,
    new Date().toISOString(),
    beforeNext || null,
    result.nextReview,
    beforeStability,
    result.state.stability,
    beforeDifficulty,
    result.state.difficulty
  ]);

  return c.json({ success: true, nextReview: result.nextReview });
});

// Update a flashcard (front/back/tags)
flashcardsRoutes.put('/:id', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const id = c.req.param('id');
  const { front, back, tags } = await c.req.json();

  const existing = await dbService.queryFirst(`SELECT id FROM flashcards WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!existing) return c.json({ success: false, error: 'Card not found' }, 404);

  const sets: string[] = [];
  const params: any[] = [];
  if (typeof front === 'string') { sets.push('front = ?'); params.push(front); }
  if (typeof back === 'string') { sets.push('back = ?'); params.push(back); }
  if (Array.isArray(tags)) { sets.push('tags = ?'); params.push(JSON.stringify(tags)); }
  sets.push('updated_at = ?'); params.push(new Date().toISOString());
  params.push(id, userId);

  await dbService.execute(`UPDATE flashcards SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);
  return c.json({ success: true });
});

// Delete a flashcard
flashcardsRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const id = c.req.param('id');

  const res = await dbService.execute(`DELETE FROM flashcards WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!res.success || res.meta.changes === 0) return c.json({ success: false, error: 'Card not found' }, 404);
  return c.json({ success: true });
});

// Get due flashcards
flashcardsRoutes.get('/due', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const courseId = c.req.query('courseId');
  const deckId = c.req.query('deckId');
  const limit = parseInt(c.req.query('limit') || '50');

  const where: string[] = ['user_id = ?'];
  const params: any[] = [userId];
  if (courseId) { where.push('course_id = ?'); params.push(courseId); }
  if (deckId) { where.push('deck_id = ?'); params.push(deckId); }
  where.push('(next_review IS NULL OR next_review <= ?)');
  params.push(new Date().toISOString());

  const sql = `SELECT * FROM flashcards WHERE ${where.join(' AND ')} ORDER BY COALESCE(next_review, created_at) ASC LIMIT ?`;
  params.push(limit);

  const cards = await dbService.query(sql, params);
  return c.json({ success: true, items: cards.map((row: any) => ({
    id: row.id,
    courseId: row.course_id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    tags: row.tags ? JSON.parse(row.tags) : [],
    nextReview: row.next_review,
  })) });
});

// Decks listing
flashcardsRoutes.get('/decks', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const courseId = c.req.query('courseId');
  const assignmentId = c.req.query('assignmentId');
  const weekId = c.req.query('weekId');
  const query = c.req.query('query');

  const where: string[] = ['user_id = ?'];
  const params: any[] = [userId];
  if (courseId) { where.push('course_id = ?'); params.push(courseId); }
  if (assignmentId) { where.push('assignment_id = ?'); params.push(assignmentId); }
  if (weekId) { where.push('week_id = ?'); params.push(weekId); }
  if (query) { where.push('LOWER(name) LIKE ?'); params.push(`%${query.toLowerCase()}%`); }

  const decks = await dbService.query(`
    SELECT d.*,
      (SELECT COUNT(*) FROM flashcards f WHERE f.deck_id = d.id) as total_cards,
      (SELECT COUNT(*) FROM flashcards f WHERE f.deck_id = d.id AND (f.next_review IS NULL OR f.next_review <= ?)) as due_now
    FROM decks d
    WHERE ${where.join(' AND ')}
    ORDER BY d.updated_at DESC
  `, [new Date().toISOString(), ...params]);

  return c.json({ success: true, decks: decks.map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    courseId: d.course_id,
    assignmentId: d.assignment_id,
    weekId: d.week_id,
    sourceType: d.source_type,
    totalCards: d.total_cards || 0,
    dueNow: d.due_now || 0,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  })) });
});

// Deck details
flashcardsRoutes.get('/decks/:id', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const deckId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const deck = await dbService.queryFirst(`SELECT * FROM decks WHERE id = ? AND user_id = ?`, [deckId, userId]);
  if (!deck) return c.json({ success: false, error: 'Deck not found' }, 404);

  const cards = await dbService.query(`
    SELECT * FROM flashcards WHERE user_id = ? AND deck_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?
  `, [userId, deckId, limit, offset]);

  const countRow = await dbService.queryFirst(`SELECT COUNT(*) as total FROM flashcards WHERE user_id = ? AND deck_id = ?`, [userId, deckId]);
  const total = (countRow as any)?.total || 0;

  return c.json({
    success: true,
    deck: {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      courseId: deck.course_id,
      assignmentId: deck.assignment_id,
      weekId: deck.week_id,
      sourceType: deck.source_type
    },
    items: cards.map((row: any) => ({ id: row.id, front: row.front, back: row.back, nextReview: row.next_review })),
    pagination: { total, limit, offset, hasMore: total > offset + limit }
  });
});

// Basic stats (totals, due now, reviewed today, new today)
flashcardsRoutes.get('/stats', async (c) => {
  const userId = c.get('userId');
  const dbService = new DatabaseService(c.env.DB);
  const courseId = c.req.query('courseId');
  const deckId = c.req.query('deckId');

  const whereCards: string[] = ['user_id = ?'];
  const paramsCards: any[] = [userId];
  if (courseId) { whereCards.push('course_id = ?'); paramsCards.push(courseId); }
  if (deckId) { whereCards.push('deck_id = ?'); paramsCards.push(deckId); }

  const totalRow = await dbService.queryFirst(`SELECT COUNT(*) as total FROM flashcards WHERE ${whereCards.join(' AND ')}`, paramsCards);
  const dueRow = await dbService.queryFirst(`SELECT COUNT(*) as due FROM flashcards WHERE ${whereCards.join(' AND ')} AND (next_review IS NULL OR next_review <= ?)`, [...paramsCards, new Date().toISOString()]);

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const createdRow = await dbService.queryFirst(`SELECT COUNT(*) as created FROM flashcards WHERE ${whereCards.join(' AND ')} AND created_at >= ?`, [...paramsCards, todayStart.toISOString()]);
  const reviewedRow = await dbService.queryFirst(`SELECT COUNT(*) as reviewed FROM flashcard_reviews WHERE user_id = ? AND reviewed_at >= ?`, [userId, todayStart.toISOString()]);

  return c.json({ success: true, stats: {
    total: (totalRow as any)?.total || 0,
    dueNow: (dueRow as any)?.due || 0,
    newToday: (createdRow as any)?.created || 0,
    reviewedToday: (reviewedRow as any)?.reviewed || 0
  }});
});

// Activity routes
const activityRoutes = new Hono();

activityRoutes.get('/recent', async (c) => {
  try {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '10');
    const actions = c.req.query('actions')?.split(',') as any[];
    
    const dbService = new DatabaseService(c.env.DB);
    const activityService = new ActivityService(dbService);
    
    // Initialize activity table if it doesn't exist
    await activityService.createActivityTable();
    
    const activities = await activityService.getRecentActivities(userId, limit, actions);
    
    // Transform for frontend
    const transformedActivities = activities.map(activity => ({
      id: activity.id,
      title: activity.resource_title,
      action: activity.action,
      type: activity.resource_type,
      course: activity.course_id ? {
        id: activity.course_id,
        name: activity.course_name || 'Unknown Course',
        color: activity.course_color || '#4A7C2A',
        code: activity.course_code || 'COURSE'
      } : undefined,
      timestamp: activity.created_at,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : {}
    }));
    
    return c.json({
      success: true,
      activities: transformedActivities
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    throw error;
  }
});

activityRoutes.get('/recent-items', async (c) => {
  try {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '5');
    
    const dbService = new DatabaseService(c.env.DB);
    const activityService = new ActivityService(dbService);
    
    // Initialize activity table if it doesn't exist
    await activityService.createActivityTable();
    
    const recentItems = await activityService.getRecentlyAccessedItems(userId, limit);
    
    return c.json({
      success: true,
      recentItems
    });
  } catch (error) {
    console.error('Get recent items error:', error);
    throw error;
  }
});

activityRoutes.get('/stats', async (c) => {
  try {
    const userId = c.get('userId');
    const days = parseInt(c.req.query('days') || '7');
    
    const dbService = new DatabaseService(c.env.DB);
    const activityService = new ActivityService(dbService);
    
    // Initialize activity table if it doesn't exist
    await activityService.createActivityTable();
    
    const stats = await activityService.getActivityStats(userId, days);
    
    return c.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get activity stats error:', error);
    throw error;
  }
});

activityRoutes.post('/log', async (c) => {
  try {
    const userId = c.get('userId');
    const { 
      action, 
      resourceType, 
      resourceId, 
      resourceTitle, 
      courseId, 
      courseName, 
      courseColor, 
      courseCode, 
      metadata 
    } = await c.req.json();
    
    if (!action || !resourceType || !resourceId || !resourceTitle) {
      createError('Missing required fields: action, resourceType, resourceId, resourceTitle', 400);
    }
    
    const dbService = new DatabaseService(c.env.DB);
    const activityService = new ActivityService(dbService);
    
    // Initialize activity table if it doesn't exist
    await activityService.createActivityTable();
    
    await activityService.logActivity(userId, action, resourceType, resourceId, resourceTitle, {
      courseId,
      courseName,
      courseColor,
      courseCode,
      metadata
    });
    
    return c.json({
      success: true,
      message: 'Activity logged successfully'
    });
  } catch (error) {
    console.error('Log activity error:', error);
    throw error;
  }
});

// AI synthesis routes
const aiRoutes = new Hono();

aiRoutes.post('/summarize', async (c) => {
  try {
    const userId = c.get('userId');
    const { documentId, options = {} } = await c.req.json();

    if (!documentId) {
      throw createError('Document ID is required', 400);
    }

    // Get document content for context
    const document = await c.env.DB.prepare(
      'SELECT title, content_preview, document_type FROM documents WHERE id = ? AND user_id = ?'
    ).bind(documentId, userId).first();

    if (!document) {
      throw createError('Document not found', 404);
    }

    // Initialize synthesis service
    const contextSynthesis = new ContextSynthesisService(
      new DatabaseService(c.env.DB),
      new EnhancedMemoryService(
        new DatabaseService(c.env.DB),
        c.env.VECTORIZE_INDEX,
        c.env.OPENAI_API_KEY || ''
      ),
      new SemanticSearchService(
        new DatabaseService(c.env.DB),
        c.env.VECTORIZE_INDEX
      ),
      new QueryProcessorService(),
      c.env.GEMINI_API_KEY
    );

    const query = `Summarize this ${document.document_type}: ${document.title}`;
    const result = await contextSynthesis.synthesizeContext(query, userId, {
      synthesisType: 'summary',
      responseStyle: options.style || 'conversational',
      maxSources: 5,
      ...options
    });

    return c.json({
      success: true,
      summary: result.synthesizedContent,
      keyPoints: result.sourceAttribution.map(source => source.excerpt),
      wordCount: result.synthesizedContent.split(/\s+/).length,
      confidence: result.confidence,
      processingTime: result.processingTime,
      sources: result.sourceAttribution
    });

  } catch (error) {
    console.error('Summarize error:', error);
    throw error;
  }
});

aiRoutes.post('/study-guide', async (c) => {
  try {
    const userId = c.get('userId');
    const { documentIds = [], courseId, options = {} } = await c.req.json();

    if (!documentIds.length && !courseId) {
      throw createError('Document IDs or course ID required', 400);
    }

    // Get documents for context
    let documents = [];
    if (courseId) {
      documents = await c.env.DB.prepare(
        'SELECT id, title, document_type FROM documents WHERE user_id = ? AND course_id = ? ORDER BY created_at DESC LIMIT 10'
      ).bind(userId, courseId).all();
    } else {
      const placeholders = documentIds.map(() => '?').join(',');
      documents = await c.env.DB.prepare(
        `SELECT id, title, document_type FROM documents WHERE id IN (${placeholders}) AND user_id = ?`
      ).bind(...documentIds, userId).all();
    }

    if (!documents.results?.length) {
      throw createError('No documents found', 404);
    }

    // Initialize synthesis service
    const contextSynthesis = new ContextSynthesisService(
      new DatabaseService(c.env.DB),
      new EnhancedMemoryService(
        new DatabaseService(c.env.DB),
        c.env.VECTORIZE_INDEX,
        c.env.OPENAI_API_KEY || ''
      ),
      new SemanticSearchService(
        new DatabaseService(c.env.DB),
        c.env.VECTORIZE_INDEX
      ),
      new QueryProcessorService(),
      c.env.GEMINI_API_KEY
    );

    const docTitles = documents.results.map(d => d.title).join(', ');
    const query = `Create a comprehensive study guide for: ${docTitles}`;
    
    const result = await contextSynthesis.synthesizeContext(query, userId, {
      synthesisType: 'summary',
      responseStyle: 'academic',
      maxSources: 15,
      ...options
    });

    // Structure the study guide
    const sections = result.synthesizedContent.split('\n\n').filter(section => section.trim());
    
    return c.json({
      success: true,
      title: `Study Guide: ${docTitles.substring(0, 50)}...`,
      sections: sections.map((content, index) => ({
        id: `section_${index}`,
        title: content.split('\n')[0].replace(/^#+\s*/, ''),
        content: content
      })),
      createdAt: new Date().toISOString(),
      confidence: result.confidence,
      processingTime: result.processingTime,
      sources: result.sourceAttribution
    });

  } catch (error) {
    console.error('Study guide error:', error);
    throw error;
  }
});

aiRoutes.post('/flashcards', async (c) => {
  try {
    const userId = c.get('userId');
    const { documentId, count = 10, difficulty = 'medium', options = {} } = await c.req.json();

    if (!documentId) {
      throw createError('Document ID is required', 400);
    }

    // Get document for context
    const document = await c.env.DB.prepare(
      'SELECT title, content_preview, document_type FROM documents WHERE id = ? AND user_id = ?'
    ).bind(documentId, userId).first();

    if (!document) {
      throw createError('Document not found', 404);
    }

    // Initialize synthesis service
    const contextSynthesis = new ContextSynthesisService(
      new DatabaseService(c.env.DB),
      new EnhancedMemoryService(
        new DatabaseService(c.env.DB),
        c.env.VECTORIZE_INDEX,
        c.env.OPENAI_API_KEY || ''
      ),
      new SemanticSearchService(
        new DatabaseService(c.env.DB),
        c.env.VECTORIZE_INDEX
      ),
      new QueryProcessorService(),
      c.env.GEMINI_API_KEY
    );

    const query = `Create ${count} ${difficulty} flashcards from this ${document.document_type}: ${document.title}. Format each as "Q: [question] | A: [answer]"`;
    
    const result = await contextSynthesis.synthesizeContext(query, userId, {
      synthesisType: 'summary',
      responseStyle: 'concise',
      maxSources: 5,
      ...options
    });

    // Parse flashcards from response
    const flashcardPattern = /Q:\s*([^|]+)\s*\|\s*A:\s*([^Q]+)/g;
    const cards = [];
    let match;

    while ((match = flashcardPattern.exec(result.synthesizedContent)) !== null && cards.length < count) {
      cards.push({
        id: `card_${cards.length + 1}`,
        front: match[1].trim(),
        back: match[2].trim(),
        difficulty,
        confidence: 0.5,
        sourceDocument: documentId
      });
    }

    // If parsing failed, create simple Q&A pairs
    if (cards.length === 0) {
      const lines = result.synthesizedContent.split('\n').filter(line => line.trim());
      for (let i = 0; i < Math.min(lines.length - 1, count); i += 2) {
        if (lines[i] && lines[i + 1]) {
          cards.push({
            id: `card_${cards.length + 1}`,
            front: lines[i].replace(/^\d+\.?\s*/, '').trim(),
            back: lines[i + 1].replace(/^\d+\.?\s*/, '').trim(),
            difficulty,
            confidence: 0.5,
            sourceDocument: documentId
          });
        }
      }
    }

    return c.json({
      success: true,
      cards,
      metadata: {
        documentTitle: document.title,
        difficulty,
        generated: cards.length,
        requested: count,
        confidence: result.confidence,
        processingTime: result.processingTime
      },
      sources: result.sourceAttribution
    });

  } catch (error) {
    console.error('Flashcards error:', error);
    throw error;
  }
});

// Mount protected routes (after auth middleware)
apiRoutes.route('/courses', coursesRoutes);
// CRN onboarding routes
import crnRoutes from './crn';
apiRoutes.route('/crn', crnRoutes);
apiRoutes.route('/documents', documentsRoutes);
apiRoutes.route('/memories', memoryRoutes);
apiRoutes.route('/notes', notesRoutes);
apiRoutes.route('/audio', audioRoutes);
apiRoutes.route('/chat', chatRoutes);
apiRoutes.route('/search', searchRoutes);
apiRoutes.route('/assignments', assignmentsRoutes);
apiRoutes.route('/flashcards', flashcardsRoutes);
apiRoutes.route('/activity', activityRoutes);
apiRoutes.route('/ai', aiRoutes);
apiRoutes.route('/planner', plannerRoutes);
apiRoutes.route('/semesters', semestersRouter);
apiRoutes.route('/tags', tagsRouter);
apiRoutes.route('/ingest/syllabus', syllabusRouter);
apiRoutes.route('/grades', gradesRouter);
