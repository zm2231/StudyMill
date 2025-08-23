import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';

interface Env {
  DB: D1Database;
}

// Validation schemas
const createSemesterSchema = z.object({
  name: z.string().min(1).max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_current: z.boolean().optional()
});

const updateSemesterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_current: z.boolean().optional()
});

export const semestersRouter = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
semestersRouter.use('*', authMiddleware);

// GET /api/semesters - Get all semesters for user
semestersRouter.get('/', async (c) => {
  const userId = c.get('userId');
  
  try {
    const semesters = await c.env.DB.prepare(`
      SELECT 
        id,
        name,
        start_date,
        end_date,
        is_current,
        created_at,
        updated_at,
        (SELECT COUNT(*) FROM courses WHERE semester_id = semesters.id AND archived = FALSE) as course_count
      FROM semesters
      WHERE user_id = ?
      ORDER BY start_date DESC
    `).bind(userId).all();

    return c.json({ semesters: semesters.results });
  } catch (error) {
    console.error('Failed to fetch semesters:', error);
    return c.json({ error: 'Failed to fetch semesters' }, 500);
  }
});

// GET /api/semesters/current - Get current semester
semestersRouter.get('/current', async (c) => {
  const userId = c.get('userId');
  
  try {
    const semester = await c.env.DB.prepare(`
      SELECT 
        id,
        name,
        start_date,
        end_date,
        is_current,
        created_at,
        updated_at
      FROM semesters
      WHERE user_id = ? AND is_current = TRUE
      LIMIT 1
    `).bind(userId).first();

    if (!semester) {
      // Try to find semester based on current date
      const now = new Date().toISOString().split('T')[0];
      const currentSemester = await c.env.DB.prepare(`
        SELECT 
          id,
          name,
          start_date,
          end_date,
          is_current,
          created_at,
          updated_at
        FROM semesters
        WHERE user_id = ? AND start_date <= ? AND end_date >= ?
        ORDER BY start_date DESC
        LIMIT 1
      `).bind(userId, now, now).first();

      if (currentSemester) {
        // Set it as current
        await c.env.DB.prepare(`
          UPDATE semesters SET is_current = TRUE WHERE id = ?
        `).bind(currentSemester.id).run();
        
        return c.json({ semester: currentSemester });
      }

      return c.json({ semester: null });
    }

    return c.json({ semester });
  } catch (error) {
    console.error('Failed to fetch current semester:', error);
    return c.json({ error: 'Failed to fetch current semester' }, 500);
  }
});

// POST /api/semesters - Create new semester
semestersRouter.post('/', async (c) => {
  const userId = c.get('userId');
  
  try {
    const body = await c.req.json();
    const validated = createSemesterSchema.parse(body);
    
    // Validate date range
    if (new Date(validated.end_date) <= new Date(validated.start_date)) {
      return c.json({ error: 'End date must be after start date' }, 400);
    }

    const id = uuidv4();
    
    // If marking as current, unset other current semesters
    if (validated.is_current) {
      await c.env.DB.prepare(`
        UPDATE semesters SET is_current = FALSE WHERE user_id = ?
      `).bind(userId).run();
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO semesters (id, user_id, name, start_date, end_date, is_current)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      validated.name,
      validated.start_date,
      validated.end_date,
      validated.is_current || false
    ).run();

    const semester = await c.env.DB.prepare(`
      SELECT * FROM semesters WHERE id = ?
    `).bind(id).first();

    return c.json({ semester }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    console.error('Failed to create semester:', error);
    return c.json({ error: 'Failed to create semester' }, 500);
  }
});

// PATCH /api/semesters/:id - Update semester
semestersRouter.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const semesterId = c.req.param('id');
  
  try {
    const body = await c.req.json();
    const validated = updateSemesterSchema.parse(body);
    
    // Check ownership
    const existing = await c.env.DB.prepare(`
      SELECT * FROM semesters WHERE id = ? AND user_id = ?
    `).bind(semesterId, userId).first();
    
    if (!existing) {
      return c.json({ error: 'Semester not found' }, 404);
    }

    // If marking as current, unset other current semesters
    if (validated.is_current) {
      await c.env.DB.prepare(`
        UPDATE semesters SET is_current = FALSE WHERE user_id = ? AND id != ?
      `).bind(userId, semesterId).run();
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    
    if (validated.name !== undefined) {
      updates.push('name = ?');
      values.push(validated.name);
    }
    if (validated.start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(validated.start_date);
    }
    if (validated.end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(validated.end_date);
    }
    if (validated.is_current !== undefined) {
      updates.push('is_current = ?');
      values.push(validated.is_current);
    }
    
    if (updates.length === 0) {
      return c.json({ error: 'No updates provided' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(semesterId);

    await c.env.DB.prepare(`
      UPDATE semesters 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    const updated = await c.env.DB.prepare(`
      SELECT * FROM semesters WHERE id = ?
    `).bind(semesterId).first();

    return c.json({ semester: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    console.error('Failed to update semester:', error);
    return c.json({ error: 'Failed to update semester' }, 500);
  }
});

// DELETE /api/semesters/:id - Delete semester (archives associated courses)
semestersRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const semesterId = c.req.param('id');
  
  try {
    // Check ownership
    const existing = await c.env.DB.prepare(`
      SELECT * FROM semesters WHERE id = ? AND user_id = ?
    `).bind(semesterId, userId).first();
    
    if (!existing) {
      return c.json({ error: 'Semester not found' }, 404);
    }

    // Archive all courses in this semester instead of deleting
    await c.env.DB.prepare(`
      UPDATE courses 
      SET archived = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE semester_id = ?
    `).bind(semesterId).run();

    // Delete the semester
    await c.env.DB.prepare(`
      DELETE FROM semesters WHERE id = ?
    `).bind(semesterId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to delete semester:', error);
    return c.json({ error: 'Failed to delete semester' }, 500);
  }
});