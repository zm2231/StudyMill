import { Hono } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { SyllabusExtractor, ExtractedSyllabus } from '../../services/syllabus/extract';
import { ParseExtractService } from '../../services/parseExtract';

// Request schema for syllabus ingestion
const syllabusIngestSchema = z.object({
  course_id: z.string(),
  syllabus_document_id: z.string(),
  schedule_document_id: z.string().optional(),
  use_parseextract_for_images: z.boolean().default(true)
});

export const syllabusRouter = new Hono<{ Bindings: Env }>();

// POST /api/ingest/syllabus - Process syllabus documents
syllabusRouter.post('/', async (c) => {
  const userId = c.get('userId');
  
  try {
    const body = await c.req.json();
    const validated = syllabusIngestSchema.parse(body);
    
    // Verify course ownership
    const course = await c.env.DB.prepare(`
      SELECT * FROM courses WHERE id = ? AND user_id = ?
    `).bind(validated.course_id, userId).first();
    
    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }

    // Process syllabus document
    const syllabusData = await processSyllabusDocument(
      c.env,
      validated.syllabus_document_id,
      userId,
      'syllabus',
      validated.use_parseextract_for_images
    );

    // Process schedule document if provided
    let scheduleData: ExtractedSyllabus | null = null;
    if (validated.schedule_document_id) {
      scheduleData = await processSyllabusDocument(
        c.env,
        validated.schedule_document_id,
        userId,
        'schedule',
        validated.use_parseextract_for_images
      );
    }

    // Merge data if both documents provided
    const extractor = new SyllabusExtractor(c.env, null);
    const mergedData = extractor.mergeSyllabusData(syllabusData, scheduleData || undefined);

    // Validate extracted data
    const validationErrors = extractor.validateExtractedData(mergedData);
    if (validationErrors.length > 0) {
      console.warn('Syllabus validation warnings:', validationErrors);
    }

    // Store extracted data in database
    await storeSyllabusData(c.env, validated.course_id, userId, mergedData);

    // Store parsing record
    const syllabusRecordId = uuidv4();
    await c.env.DB.prepare(`
      INSERT INTO syllabus_documents (id, course_id, user_id, document_id, document_type, parsed_data, parsing_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      syllabusRecordId,
      validated.course_id,
      userId,
      validated.syllabus_document_id,
      'syllabus',
      JSON.stringify(mergedData),
      'completed'
    ).run();

    if (validated.schedule_document_id) {
      const scheduleRecordId = uuidv4();
      await c.env.DB.prepare(`
        INSERT INTO syllabus_documents (id, course_id, user_id, document_id, document_type, parsed_data, parsing_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        scheduleRecordId,
        validated.course_id,
        userId,
        validated.schedule_document_id,
        'schedule',
        JSON.stringify(scheduleData),
        'completed'
      ).run();
    }

    return c.json({
      success: true,
      data: mergedData,
      validation_warnings: validationErrors
    });
  } catch (error) {
    console.error('Syllabus ingestion failed:', error);
    return c.json({ 
      error: 'Failed to process syllabus',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// GET /api/ingest/syllabus/:courseId - Get parsed syllabus data
syllabusRouter.get('/:courseId', async (c) => {
  const userId = c.get('userId');
  const courseId = c.req.param('courseId');
  
  try {
    // Verify course ownership
    const course = await c.env.DB.prepare(`
      SELECT * FROM courses WHERE id = ? AND user_id = ?
    `).bind(courseId, userId).first();
    
    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }

    // Get grade weights
    const weights = await c.env.DB.prepare(`
      SELECT * FROM grade_weights WHERE course_id = ? ORDER BY weight_pct DESC
    `).bind(courseId).all();

    // Get assignments with syllabus source
    const assignments = await c.env.DB.prepare(`
      SELECT * FROM assignments 
      WHERE course_id = ? AND source IN ('syllabus', 'schedule')
      ORDER BY due_date ASC
    `).bind(courseId).all();

    // Get parsed syllabus documents
    const syllabusRecords = await c.env.DB.prepare(`
      SELECT * FROM syllabus_documents 
      WHERE course_id = ? AND parsing_status = 'completed'
      ORDER BY created_at DESC
    `).bind(courseId).all();

    return c.json({
      grade_weights: weights.results,
      assignments: assignments.results,
      syllabus_records: syllabusRecords.results
    });
  } catch (error) {
    console.error('Failed to fetch syllabus data:', error);
    return c.json({ error: 'Failed to fetch syllabus data' }, 500);
  }
});

// Helper function to process a syllabus document
async function processSyllabusDocument(
  env: Env,
  documentId: string,
  userId: string,
  documentType: 'syllabus' | 'schedule',
  useParseExtract: boolean
): Promise<ExtractedSyllabus> {
  // Get document from database
  const document = await env.DB.prepare(`
    SELECT * FROM documents WHERE id = ? AND user_id = ?
  `).bind(documentId, userId).first();
  
  if (!document) {
    throw new Error('Document not found');
  }

  // Get file from R2
  const file = await env.BUCKET.get(document.r2_key);
  if (!file) {
    throw new Error('Document file not found in storage');
  }

  const fileBuffer = await file.arrayBuffer();
  let extractedText = '';

  // Extract text based on file type
  const fileType = document.file_type.toLowerCase();
  
  if (fileType.includes('pdf')) {
    // Use ParseExtract for PDF extraction (Workers-safe)
    extractedText = await extractTextFromPDFWithParseExtract(env, fileBuffer, document.filename || 'document.pdf');
  } else if (fileType.includes('word') || fileType.includes('docx')) {
    // Use ParseExtract for DOCX/Word documents
    extractedText = await extractTextFromDocWithParseExtract(env, fileBuffer, document.filename || 'document.docx', document.file_type);
  } else if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg')) {
    // Use ParseExtract for images
    if (useParseExtract) {
      extractedText = await extractTextFromImageWithParseExtract(env, fileBuffer, fileType);
    } else {
      throw new Error('Image processing requires ParseExtract API');
    }
  } else {
    // Fallback: try ParseExtract for other types as well
    extractedText = await extractTextFromGenericWithParseExtract(env, fileBuffer, document.filename || 'document', document.file_type);
  }

  // Use AI to extract structured data
  const extractor = new SyllabusExtractor(env, {
    generateStructuredOutput: async (params: any) => {
      // Call your AI service here (Groq, OpenAI, or Cloudflare AI)
      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        prompt: params.prompt,
        temperature: params.temperature || 0.1,
        max_tokens: 2048
      });
      
      // Parse JSON response
      try {
        const jsonMatch = response.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No JSON found in response');
      } catch (error) {
        console.error('Failed to parse AI response:', response);
        throw new Error('Failed to parse AI response as JSON');
      }
    }
  });

  return await extractor.extractFromText(extractedText, documentType);
}

// Extract text from PDF using ParseExtract API (Workers-safe)
async function extractTextFromPDFWithParseExtract(
  env: Env,
  buffer: ArrayBuffer,
  fileName: string
): Promise<string> {
  if (!env.temp_PARSE_EXTRACT_API_KEY) {
    throw new Error('ParseExtract API key not configured');
  }

  const service = new ParseExtractService(env.temp_PARSE_EXTRACT_API_KEY);
  const result = await service.processDocument(buffer, 'application/pdf', fileName);

  if (!result.success || !result.data?.text) {
    throw new Error(result.error || 'Failed to extract text from PDF');
  }

  return result.data.text;
}

// Extract text from image using ParseExtract API
async function extractTextFromImageWithParseExtract(
  env: Env,
  buffer: ArrayBuffer,
  mimeType: string
): Promise<string> {
  if (!env.temp_PARSE_EXTRACT_API_KEY) {
    throw new Error('ParseExtract API key not configured');
  }

  // Convert ArrayBuffer to base64
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  
  // Call ParseExtract API
  const response = await fetch('https://api.parseextract.com/v1/ocr', {
    method: 'POST',
    headers: {
'Authorization': `Bearer ${env.temp_PARSE_EXTRACT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image: `data:${mimeType};base64,${base64}`,
      ocr_engine: 'advanced', // Use advanced OCR for better accuracy
      output_format: 'text'
    })
  });

  if (!response.ok) {
    throw new Error(`ParseExtract API error: ${response.status}`);
  }

  const result = await response.json();
  return result.text || '';
}

// Extract text from DOCX/Word using ParseExtract API
async function extractTextFromDocWithParseExtract(
  env: Env,
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  if (!env.temp_PARSE_EXTRACT_API_KEY) {
    throw new Error('ParseExtract API key not configured');
  }

  const service = new ParseExtractService(env.temp_PARSE_EXTRACT_API_KEY);
  const type = mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const result = await service.processDocument(buffer, type, fileName);

  if (!result.success || !result.data?.text) {
    throw new Error(result.error || 'Failed to extract text from DOCX');
  }

  return result.data.text;
}

// Generic extractor using ParseExtract for other file types
async function extractTextFromGenericWithParseExtract(
  env: Env,
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  if (!env.temp_PARSE_EXTRACT_API_KEY) {
    throw new Error('ParseExtract API key not configured');
  }

  const service = new ParseExtractService(env.temp_PARSE_EXTRACT_API_KEY);
  const result = await service.processDocument(buffer, mimeType || 'application/octet-stream', fileName);

  if (!result.success || !result.data?.text) {
    throw new Error(result.error || 'Failed to extract text');
  }

  return result.data.text;
}

// Store extracted syllabus data in database
async function storeSyllabusData(
  env: Env,
  courseId: string,
  userId: string,
  data: ExtractedSyllabus
): Promise<void> {
  // Clear existing grade weights for this course
  await env.DB.prepare(`
    DELETE FROM grade_weights WHERE course_id = ?
  `).bind(courseId).run();

  // Insert new grade weights
  for (const weight of data.grading_weights) {
    const id = uuidv4();
    await env.DB.prepare(`
      INSERT INTO grade_weights (id, course_id, user_id, name, weight_pct)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, courseId, userId, weight.name, weight.weight_pct).run();
  }

  // Insert assignments (avoid duplicates)
  for (const assignment of data.assignments) {
    // Check if assignment already exists
    const existing = await env.DB.prepare(`
      SELECT id FROM assignments 
      WHERE course_id = ? AND LOWER(title) = LOWER(?)
    `).bind(courseId, assignment.title).first();

    if (!existing) {
      const id = uuidv4();
      await env.DB.prepare(`
        INSERT INTO assignments (
          id, course_id, user_id, title, assignment_type, 
          due_date, week_no, points, weight_category, source, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        courseId,
        userId,
        assignment.title,
        assignment.type || 'homework',
        assignment.dueDate || null,
        assignment.week_no || null,
        assignment.points || null,
        assignment.weight_category || null,
        'syllabus',
        'pending'
      ).run();
    }
  }

  // Update course information if extracted
  if (data.course_info) {
    const updates: string[] = [];
    const values: any[] = [];
    
    if (data.course_info.instructor) {
      updates.push('instructor = ?');
      values.push(data.course_info.instructor);
    }
    if (data.course_info.credits) {
      updates.push('credits = ?');
      values.push(data.course_info.credits);
    }
    if (data.course_info.code) {
      updates.push('code = ?');
      values.push(data.course_info.code);
    }
    
    if (updates.length > 0) {
      values.push(courseId);
      await env.DB.prepare(`
        UPDATE courses 
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(...values).run();
    }
  }
}