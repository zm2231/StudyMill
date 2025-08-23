import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { 
  rebuildSemesterWeeks, 
  groupAssignmentsByWeek,
  getCurrentWeek,
  autoAssignWeekNumbers 
} from '../services/planner/weekBuckets';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Validation schemas
const SemesterParamsSchema = z.object({
  semesterId: z.string()
});

const CourseParamsSchema = z.object({
  courseId: z.string()
});

/**
 * GET /planner/weeks/:semesterId
 * Get week buckets with assignments for a semester
 */
app.get('/weeks/:semesterId', 
  zValidator('param', SemesterParamsSchema),
  async (c) => {
    try {
      const { semesterId } = c.req.valid('param');
      const userId = c.get('userId');
      
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Get course weeks for this semester
      const weeks = await c.env.DB.prepare(`
        SELECT cw.*, s.name as semester_name 
        FROM course_weeks cw
        JOIN semesters s ON cw.semester_id = s.id
        WHERE cw.semester_id = ? AND s.user_id = ?
        ORDER BY cw.week_number ASC
      `).bind(semesterId, userId).all();
      
      if (weeks.results.length === 0) {
        // Try to rebuild weeks if none exist
        try {
          const newWeeks = await rebuildSemesterWeeks(c.env, semesterId);
          if (newWeeks.length === 0) {
            return c.json({ error: 'No weeks found and unable to generate' }, 404);
          }
        } catch (error) {
          return c.json({ error: 'Failed to generate weeks' }, 500);
        }
        
        // Re-fetch after rebuild
        const rebuiltWeeks = await c.env.DB.prepare(`
          SELECT cw.*, s.name as semester_name 
          FROM course_weeks cw
          JOIN semesters s ON cw.semester_id = s.id
          WHERE cw.semester_id = ? AND s.user_id = ?
          ORDER BY cw.week_number ASC
        `).bind(semesterId, userId).all();
        
        return c.json(rebuiltWeeks.results);
      }
      
      return c.json(weeks.results);
    } catch (error) {
      console.error('Error fetching weeks:', error);
      return c.json({ error: 'Failed to fetch weeks' }, 500);
    }
  }
);

/**
 * POST /planner/weeks/:semesterId/rebuild
 * Rebuild week buckets for a semester
 */
app.post('/weeks/:semesterId/rebuild',
  zValidator('param', SemesterParamsSchema),
  async (c) => {
    try {
      const { semesterId } = c.req.valid('param');
      const userId = c.get('userId');
      
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Verify user owns this semester
      const semester = await c.env.DB.prepare(
        'SELECT id FROM semesters WHERE id = ? AND user_id = ?'
      ).bind(semesterId, userId).first();
      
      if (!semester) {
        return c.json({ error: 'Semester not found' }, 404);
      }
      
      const weeks = await rebuildSemesterWeeks(c.env, semesterId);
      return c.json({ 
        message: 'Weeks rebuilt successfully',
        weeks: weeks.length,
        data: weeks
      });
    } catch (error) {
      console.error('Error rebuilding weeks:', error);
      return c.json({ error: 'Failed to rebuild weeks' }, 500);
    }
  }
);

/**
 * GET /planner/assignments/:semesterId/by-week
 * Get assignments grouped by week for a semester
 */
app.get('/assignments/:semesterId/by-week',
  zValidator('param', SemesterParamsSchema),
  async (c) => {
    try {
      const { semesterId } = c.req.valid('param');
      const userId = c.get('userId');
      
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Get course weeks
      const weeks = await c.env.DB.prepare(`
        SELECT * FROM course_weeks 
        WHERE semester_id = ?
        ORDER BY week_number ASC
      `).bind(semesterId).all();
      
      // Get assignments for courses in this semester
      const assignments = await c.env.DB.prepare(`
        SELECT a.*, c.name as course_name, c.color as course_color
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        WHERE c.semester_id = ? AND a.user_id = ?
        ORDER BY a.due_date ASC, a.week_no ASC
      `).bind(semesterId, userId).all();
      
      // Group assignments by week
      const weekBuckets = groupAssignmentsByWeek(
        assignments.results as any[], 
        weeks.results as any[]
      );
      
      // Get current week info
      const currentWeek = getCurrentWeek(weeks.results as any[]);
      
      return c.json({
        weeks: weekBuckets,
        current_week: currentWeek,
        total_assignments: assignments.results.length
      });
    } catch (error) {
      console.error('Error fetching assignments by week:', error);
      return c.json({ error: 'Failed to fetch assignments' }, 500);
    }
  }
);

/**
 * GET /planner/assignments/current-week
 * Get assignments for the current week across all active semesters
 */
app.get('/assignments/current-week', async (c) => {
  try {
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // Get assignments due this week
    const assignments = await c.env.DB.prepare(`
      SELECT 
        a.*,
        c.name as course_name,
        c.color as course_color,
        s.name as semester_name,
        cw.week_number,
        cw.start_date as week_start,
        cw.end_date as week_end
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN semesters s ON c.semester_id = s.id
      LEFT JOIN course_weeks cw ON (
        s.id = cw.semester_id AND 
        cw.start_date <= ? AND 
        cw.end_date >= ?
      )
      WHERE 
        a.user_id = ? AND
        s.is_current = 1 AND
        (
          (a.due_date IS NOT NULL AND DATE(a.due_date) BETWEEN cw.start_date AND cw.end_date) OR
          (a.week_no IS NOT NULL AND a.week_no = cw.week_number)
        )
      ORDER BY a.due_date ASC, a.created_at ASC
    `).bind(today, today, userId).all();
    
    return c.json({
      assignments: assignments.results,
      week_start: assignments.results[0]?.week_start || today,
      week_end: assignments.results[0]?.week_end || today
    });
  } catch (error) {
    console.error('Error fetching current week assignments:', error);
    return c.json({ error: 'Failed to fetch current week assignments' }, 500);
  }
});

/**
 * POST /planner/courses/:courseId/auto-assign-weeks
 * Auto-assign week numbers to assignments based on due dates
 */
app.post('/courses/:courseId/auto-assign-weeks',
  zValidator('param', CourseParamsSchema),
  async (c) => {
    try {
      const { courseId } = c.req.valid('param');
      const userId = c.get('userId');
      
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Get course and verify ownership
      const course = await c.env.DB.prepare(
        'SELECT semester_id FROM courses WHERE id = ? AND user_id = ?'
      ).bind(courseId, userId).first();
      
      if (!course) {
        return c.json({ error: 'Course not found' }, 404);
      }
      
      await autoAssignWeekNumbers(c.env, courseId, course.semester_id);
      
      return c.json({ 
        message: 'Week numbers assigned successfully' 
      });
    } catch (error) {
      console.error('Error auto-assigning weeks:', error);
      return c.json({ error: 'Failed to assign week numbers' }, 500);
    }
  }
);

/**
 * GET /planner/stats/:semesterId
 * Get planner statistics for a semester
 */
app.get('/stats/:semesterId',
  zValidator('param', SemesterParamsSchema),
  async (c) => {
    try {
      const { semesterId } = c.req.valid('param');
      const userId = c.get('userId');
      
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      // Get assignment statistics
      const stats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_assignments,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_assignments,
          COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_assignments,
          COUNT(CASE WHEN due_date IS NOT NULL AND DATE(due_date) = DATE('now') THEN 1 END) as due_today,
          COUNT(CASE WHEN due_date IS NOT NULL AND DATE(due_date) BETWEEN DATE('now') AND DATE('now', '+7 days') THEN 1 END) as due_this_week
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        WHERE c.semester_id = ? AND a.user_id = ?
      `).bind(semesterId, userId).first();
      
      return c.json(stats);
    } catch (error) {
      console.error('Error fetching planner stats:', error);
      return c.json({ error: 'Failed to fetch stats' }, 500);
    }
  }
);

export default app;