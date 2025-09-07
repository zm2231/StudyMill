import { Hono } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono<{ Bindings: Env }>();

const CreateFromCRNSchema = z.object({
  term_code: z.string().regex(/^\d{6}$/),   // e.g., 202508 (6-digit term code)
  crn: z.string().regex(/^\d{5}$/),         // 5-digit CRN
  semester_id: z.string().optional()         // Optional semester link from UI
});

// POST /api/v1/crn/create-course
// Creates a course for the current user from UGA master course row
app.post('/create-course', async (c) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { term_code, crn, semester_id } = CreateFromCRNSchema.parse(body);

    // Find matching row in master table
    const row = await c.env.DB.prepare(
      `SELECT * FROM uga_courses_master WHERE term_code = ? AND crn = ? LIMIT 1`
    ).bind(term_code, crn).first();

    if (!row) {
      return c.json({ error: 'CRN not found for specified term' }, 404);
    }

    // Semester linking: prefer provided semester_id if owned by user; else fallback map by term_code
    let semesterId: string | null = null;

    if (semester_id) {
      try {
        const owned = await c.env.DB.prepare(
          `SELECT id FROM semesters WHERE id = ? AND user_id = ? LIMIT 1`
        ).bind(semester_id, userId).first<{ id: string }>();
        semesterId = owned?.id || null;
      } catch {}
    }

    if (!semesterId) {
      // Resolve human-readable name from term_code (e.g., 202508 -> Fall 2025)
      const toNameFromTerm = (code: string): string | null => {
        if (!/^\d{6}$/.test(code)) return null;
        const year = code.slice(0, 4);
        const mm = code.slice(4, 6);
        const season = mm === '01' ? 'Spring' : mm === '05' ? 'Summer' : mm === '08' ? 'Fall' : null;
        return season ? `${season} ${year}` : null;
      };

      const semestersTable = await c.env.DB.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='semesters'`
      ).first();

      if (semestersTable) {
        // Try: derive start/end from academic_calendar_dates if available
        let startDate: string | null = null;
        let endDate: string | null = null;
        let semName = toNameFromTerm(term_code) || `Term ${term_code}`;

        const calTable = await c.env.DB.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='academic_calendar_dates'`
        ).first();

        if (calTable) {
          try {
            const startRow = await c.env.DB.prepare(`
              SELECT date FROM academic_calendar_dates
              WHERE term_code = ?
                AND (
                  lower(name) LIKE '%semester start%'
                  OR lower(name) LIKE '%classes begin%'
                  OR lower(name) LIKE '%instruction begins%'
                )
              ORDER BY date ASC LIMIT 1
            `).bind(term_code).first<{ date: string }>();

            const endRowPref = await c.env.DB.prepare(`
              SELECT date FROM academic_calendar_dates
              WHERE term_code = ?
                AND (
                  lower(name) LIKE '%semester end%'
                  OR lower(name) LIKE '%last day of classes%'
                  OR lower(name) LIKE '%classes end%'
                )
              ORDER BY date DESC LIMIT 1
            `).bind(term_code).first<{ date: string }>();

            const finalsEndRow = await c.env.DB.prepare(`
              SELECT date FROM academic_calendar_dates
              WHERE term_code = ? AND lower(name) LIKE '%finals end%'
              ORDER BY date DESC LIMIT 1
            `).bind(term_code).first<{ date: string }>();

            startDate = startRow?.date || null;
            endDate = endRowPref?.date || finalsEndRow?.date || null;

            // Absolute fallback if we have rows but not matching names: min/max of the term
            if (!startDate || !endDate) {
              const minMax = await c.env.DB.prepare(`
                SELECT MIN(date) AS min_d, MAX(date) AS max_d
                FROM academic_calendar_dates WHERE term_code = ?
              `).bind(term_code).first<{ min_d: string; max_d: string }>();
              startDate = startDate || minMax?.min_d || null;
              endDate = endDate || minMax?.max_d || null;
            }
          } catch {}
        }

        // If calendar dates are missing, provide reasonable default ranges by term
        if (!startDate || !endDate) {
          const TERM_META_FALLBACK: Record<string, { start_date: string; end_date: string }> = {
            '202508': { start_date: '2025-08-15', end_date: '2025-12-15' },
            '202601': { start_date: '2026-01-06', end_date: '2026-05-05' }
          };
          const fb = TERM_META_FALLBACK[term_code];
          startDate = startDate || fb?.start_date || null;
          endDate = endDate || fb?.end_date || null;
        }

        try {
          // Attempt to find an existing semester by name
          const existing = await c.env.DB.prepare(
            `SELECT id FROM semesters WHERE user_id = ? AND name = ? LIMIT 1`
          ).bind(userId, semName).first<{ id: string }>();

          if (existing?.id) {
            semesterId = existing.id;
          } else {
            // Create the semester for this user with any available columns
            const cols = await c.env.DB.prepare(`PRAGMA table_info(semesters)`).all();
            const have = new Set((cols.results as any[]).map((r) => r.name as string));
            const newSemesterId = uuidv4();

            const rowIns: Record<string, any> = { id: newSemesterId };
            if (have.has('user_id')) rowIns.user_id = userId;
            if (have.has('name')) rowIns.name = semName;
            if (startDate && have.has('start_date')) rowIns.start_date = startDate;
            if (endDate && have.has('end_date')) rowIns.end_date = endDate;
            if (have.has('is_current')) rowIns.is_current = 0;

            const colsList = Object.keys(rowIns);
            const placeholders = colsList.map(() => '?').join(',');
            await c.env.DB.prepare(
              `INSERT INTO semesters (${colsList.join(',')}) VALUES (${placeholders})`
            ).bind(...colsList.map((k) => (rowIns as any)[k])).run();

            semesterId = newSemesterId;
          }
        } catch (e) {
          console.warn('Semester link/create failed; proceeding without semester link', e);
          semesterId = null;
        }
      }
    }

    // Build a friendly course code like "CSCI 1301"
    const code = `${row.subject} ${row.catalog_number}`.trim();

    // Create course (be resilient to older schemas missing some columns)
    const courseId = uuidv4();

    // Determine available columns on the courses table
    const colsResult = await c.env.DB.prepare(`PRAGMA table_info(courses)`).all();
    const availableCols = new Set((colsResult.results as any[]).map((r) => r.name as string));

    // Core columns that should always exist
    const data: Record<string, any> = {
      id: courseId,
      user_id: userId,
      name: row.course_title,
      description: null
    };

    // Optional columns (insert only if they exist in the current schema)
    if (availableCols.has('code')) data.code = code;
    if (availableCols.has('crn')) data.crn = row.crn;
    if (availableCols.has('semester_id')) data.semester_id = semesterId;
    if (availableCols.has('instructor')) data.instructor = row.instructor || null;
    if (availableCols.has('credits')) data.credits = row.credits || null;
    if (availableCols.has('location')) data.location = row.location || null;
    if (availableCols.has('schedule_json')) data.schedule_json = null;

    // Always include timestamps if present (created_at/updated_at default via CURRENT_TIMESTAMP)
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');

    await c.env.DB.prepare(
      `INSERT INTO courses (${columns.join(', ')}) VALUES (${placeholders})`
    ).bind(...columns.map((k) => (data as any)[k])).run();

    // Parse meeting days into course_schedules
    // UGA format examples: 'MWF', 'TR', 'MTWR', 'ONLINE', 'TBA'
    const meetingDaysRaw = (row.days || '').toUpperCase().trim();
    const isOnlineOrTBA = meetingDaysRaw.includes('ONLINE') || meetingDaysRaw.includes('TBA');

    // Standard mapping (0=Sun..6=Sat). UGA: M,T,W,R,F; we'll ignore weekends unless present.
    const dayMap: Record<string, number> = {
      'M': 1,
      'T': 2,
      'W': 3,
      'R': 4, // Thursday; pairs like 'TR' split into 'T' and 'R'
      'F': 5
    };

    // Validate meeting days contain only known tokens (char-wise for UGA)
    const validDayChars = new Set(Object.keys(dayMap));
    const isValidDays = meetingDaysRaw === '' || isOnlineOrTBA || meetingDaysRaw.split('').every(ch => validDayChars.has(ch));

    const start = (row.start_time || '').slice(0, 5); // HH:MM
    const end = (row.end_time || '').slice(0, 5);

    if (!isOnlineOrTBA && isValidDays && start && end) {
      // Only insert into course_schedules if the table exists
      const tableCheck = await c.env.DB.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='course_schedules'`
      ).first();

      if (tableCheck) {
        for (const ch of meetingDaysRaw.split('')) {
          const dow = dayMap[ch];
          if (dow === undefined) continue;
          await c.env.DB.prepare(`
            INSERT INTO course_schedules (id, course_id, day_of_week, start_time, end_time, location)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(uuidv4(), courseId, dow, start, end, row.location || null).run();
        }
      }
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
