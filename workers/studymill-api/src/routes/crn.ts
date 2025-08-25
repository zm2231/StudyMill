import { Hono } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono<{ Bindings: Env }>();

const CreateFromCRNSchema = z.object({
  term_code: z.string().regex(/^\d{6}$/),   // e.g., 202508
  crn: z.string().regex(/^\d{5}$/)
});

// POST /api/v1/crn/create-course
// Creates a course for the current user from UGA master course row
app.post('/create-course', async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { term_code, crn } = CreateFromCRNSchema.parse(body);

    // Find matching row in master table
    const row = await c.env.DB.prepare(
      `SELECT * FROM uga_courses_master WHERE term_code = ? AND crn = ? LIMIT 1`
    ).bind(term_code, crn).first();

    if (!row) {
      return c.json({ error: 'CRN not found for specified term' }, 404);
    }

    // Optional: try to find or create semester by term_code mapping
    // If you already have a semesters table with records, try to find it
    let semesterId: string | null = null;
    try {
      const existingSemester = await c.env.DB.prepare(
        `SELECT id FROM semesters WHERE user_id = ? AND name LIKE ? LIMIT 1`
      ).bind(userId, `%${term_code}%`).first();
      semesterId = existingSemester?.id || null;
    } catch {}

    // Build a friendly course code like "CSCI 1301"
    const code = `${row.subject} ${row.catalog_number}`.trim();

    // Create course
    const courseId = uuidv4();
    await c.env.DB.prepare(`
      INSERT INTO courses (id, user_id, name, description, code, crn, semester_id, instructor, credits, location, schedule_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      courseId,
      userId,
      row.course_title,
      null,
      code,
      row.crn,
      semesterId,
      row.instructor || null,
      row.credits || null,
      row.location || null
    ).run();

    // Parse meeting days into course_schedules
    // Expected days format examples: 'MWF', 'TR', 'MTWR', 'Online'
    const meetingDays = (row.days || '').toUpperCase();
    const dayMap: Record<string, number> = {
      'U': 0, // some schools use U for Sunday
      'S': 0, // alternative
      'M': 1,
      'T': 2,
      'W': 3,
      'R': 4,
      'F': 5,
      'A': 6, // some odd datasets may use A for Saturday; keep map flexible
      'S2': 6 // guard
    };

    const start = (row.start_time || '').slice(0,5); // HH:MM
    const end = (row.end_time || '').slice(0,5);

    const chars = meetingDays.split('');
    for (const ch of chars) {
      if (!dayMap.hasOwnProperty(ch)) continue;
      const dow = dayMap[ch];
      if (!start || !end) continue; // skip if missing time
      await c.env.DB.prepare(`
        INSERT INTO course_schedules (id, course_id, day_of_week, start_time, end_time, location)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(uuidv4(), courseId, dow, start, end, row.location || null).run();
    }

    return c.json({
      success: true,
      course: {
        id: courseId,
        name: row.course_title,
        code,
        crn: row.crn,
        instructor: row.instructor || null,
        credits: row.credits || null,
        location: row.location || null,
        semester_id: semesterId
      }
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    console.error('CRN create-course error:', error);
    return c.json({ error: 'Failed to create course from CRN' }, 500);
  }
});

// GET /api/v1/crn/lookup?term_code=202508&crn=12345
// Returns the catalog row without creating a course (for preview UI)
app.get('/lookup', async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const term_code = c.req.query('term_code');
  const crn = c.req.query('crn');
  if (!term_code || !crn) return c.json({ error: 'term_code and crn are required' }, 400);

  try {
    const row = await c.env.DB.prepare(
      `SELECT * FROM uga_courses_master WHERE term_code = ? AND crn = ? LIMIT 1`
    ).bind(term_code, crn).first();

    if (!row) return c.json({ error: 'Not found' }, 404);

    const code = `${row.subject} ${row.catalog_number}`.trim();
    return c.json({
      success: true,
      course_preview: {
        code,
        title: row.course_title,
        instructor: row.instructor,
        credits: row.credits,
        days: row.days,
        start_time: row.start_time,
        end_time: row.end_time,
        location: row.location
      }
    });
  } catch (error) {
    console.error('CRN lookup error:', error);
    return c.json({ error: 'Lookup failed' }, 500);
  }
});

export default app;
