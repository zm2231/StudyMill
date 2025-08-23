import { AuthUtils } from '../utils/auth';

export interface Course {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  code?: string;
  color?: string;
  instructor?: string;
  credits?: number;
  semester_id?: string;
  archived?: boolean;
  schedule?: string; // JSON string of schedule times
  created_at: string;
  updated_at: string;
}

export interface CreateCourseData {
  name: string;
  description?: string;
  code?: string;
  color?: string;
  instructor?: string;
  credits?: number;
  semester_id?: string;
  schedule?: any[]; // Will be JSON stringified
}

export interface UpdateCourseData {
  name?: string;
  description?: string;
  code?: string;
  color?: string;
  instructor?: string;
  credits?: number;
  semester_id?: string;
  archived?: boolean;
  schedule?: any[]; // Will be JSON stringified
}

export class DatabaseService {
  constructor(public db: D1Database) {}

  // Course operations
  async createCourse(userId: string, data: CreateCourseData): Promise<Course> {
    const id = 'course_' + crypto.randomUUID();
    const now = new Date().toISOString();
    const scheduleJson = data.schedule ? JSON.stringify(data.schedule) : null;
    
    const result = await this.db.prepare(`
      INSERT INTO courses (id, user_id, name, description, code, color, instructor, credits, semester_id, schedule, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, 
      userId, 
      data.name, 
      data.description || null,
      data.code || null,
      data.color || '#4A7C2A', // Forest green default
      data.instructor || null,
      data.credits || 3,
      data.semester_id || null,
      scheduleJson,
      false, // not archived by default
      now, 
      now
    ).run();

    if (!result.success) {
      throw new Error('Failed to create course');
    }

    return {
      id,
      user_id: userId,
      name: data.name,
      description: data.description,
      code: data.code,
      color: data.color || '#4A7C2A',
      instructor: data.instructor,
      credits: data.credits || 3,
      semester_id: data.semester_id,
      schedule: scheduleJson || undefined,
      archived: false,
      created_at: now,
      updated_at: now
    };
  }

  async getCoursesByUserId(userId: string, includeArchived: boolean = false): Promise<Course[]> {
    const query = includeArchived ? 
      `SELECT * FROM courses WHERE user_id = ? ORDER BY created_at DESC` :
      `SELECT * FROM courses WHERE user_id = ? AND (archived = FALSE OR archived IS NULL) ORDER BY created_at DESC`;
    
    const result = await this.db.prepare(query).bind(userId).all();
    return result.results as Course[];
  }

  async getCoursesBySemester(userId: string, semesterId: string, includeArchived: boolean = false): Promise<Course[]> {
    const query = includeArchived ?
      `SELECT * FROM courses WHERE user_id = ? AND semester_id = ? ORDER BY created_at DESC` :
      `SELECT * FROM courses WHERE user_id = ? AND semester_id = ? AND (archived = FALSE OR archived IS NULL) ORDER BY created_at DESC`;
    
    const result = await this.db.prepare(query).bind(userId, semesterId).all();
    return result.results as Course[];
  }

  async getCourseById(courseId: string, userId: string): Promise<Course | null> {
    const result = await this.db.prepare(`
      SELECT * FROM courses 
      WHERE id = ? AND user_id = ?
    `).bind(courseId, userId).first();

    return result as Course | null;
  }

  async updateCourse(courseId: string, userId: string, data: UpdateCourseData): Promise<Course | null> {
    const existing = await this.getCourseById(courseId, userId);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();
    const name = data.name !== undefined ? data.name : existing.name;
    const description = data.description !== undefined ? data.description : existing.description;
    const code = data.code !== undefined ? data.code : existing.code;
    const color = data.color !== undefined ? data.color : existing.color;
    const instructor = data.instructor !== undefined ? data.instructor : existing.instructor;
    const credits = data.credits !== undefined ? data.credits : existing.credits;
    const semester_id = data.semester_id !== undefined ? data.semester_id : existing.semester_id;
    const archived = data.archived !== undefined ? data.archived : existing.archived;
    const schedule = data.schedule !== undefined ? JSON.stringify(data.schedule) : existing.schedule;

    const result = await this.db.prepare(`
      UPDATE courses 
      SET name = ?, description = ?, code = ?, color = ?, instructor = ?, credits = ?, semester_id = ?, archived = ?, schedule = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(name, description, code, color, instructor, credits, semester_id, archived, schedule, now, courseId, userId).run();

    if (!result.success) {
      throw new Error('Failed to update course');
    }

    return {
      id: courseId,
      user_id: userId,
      name,
      description,
      code,
      color,
      instructor,
      credits,
      semester_id,
      archived,
      schedule,
      created_at: existing.created_at,
      updated_at: now
    };
  }

  async deleteCourse(courseId: string, userId: string): Promise<boolean> {
    const result = await this.db.prepare(`
      DELETE FROM courses 
      WHERE id = ? AND user_id = ?
    `).bind(courseId, userId).run();

    return result.success && result.changes > 0;
  }

  async getCourseCount(userId: string, includeArchived: boolean = false): Promise<number> {
    const query = includeArchived ?
      `SELECT COUNT(*) as count FROM courses WHERE user_id = ?` :
      `SELECT COUNT(*) as count FROM courses WHERE user_id = ? AND (archived = FALSE OR archived IS NULL)`;
    
    const result = await this.db.prepare(query).bind(userId).first();
    return (result as any)?.count || 0;
  }

  async getMemoryCountByCourse(courseId: string, userId: string): Promise<number> {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM memories 
      WHERE user_id = ? 
        AND JSON_EXTRACT(container_tags, '$') LIKE ?
        AND deleted_at IS NULL
    `).bind(userId, `%"${courseId}"%`).first();

    return (result as any)?.count || 0;
  }

  async getMemoryCountsByCourses(courseIds: string[], userId: string): Promise<Record<string, number>> {
    if (courseIds.length === 0) {
      return {};
    }

    // Build a query that counts memories for each course in a single DB call
    const placeholders = courseIds.map(() => '?').join(',');
    const likeConditions = courseIds.map(() => 'JSON_EXTRACT(container_tags, \'$\') LIKE ?').join(' OR ');
    
    const result = await this.db.prepare(`
      SELECT 
        c.course_id,
        COUNT(m.id) as count
      FROM (
        ${courseIds.map((_, index) => `SELECT ? as course_id`).join(' UNION ALL ')}
      ) c
      LEFT JOIN memories m ON (
        m.user_id = ? 
        AND JSON_EXTRACT(m.container_tags, '$') LIKE '%"' || c.course_id || '"%'
        AND m.deleted_at IS NULL
      )
      GROUP BY c.course_id
    `).bind(
      ...courseIds, // Course IDs for the UNION
      userId // User ID for the LEFT JOIN
    ).all();

    const counts: Record<string, number> = {};
    (result.results as any[]).forEach(row => {
      counts[row.course_id] = row.count || 0;
    });

    return counts;
  }

  // Generic query method for complex queries
  async query(sql: string, params: any[] = []): Promise<any[]> {
    const result = await this.db.prepare(sql).bind(...params).all();
    return result.results || [];
  }

  // Query method that returns the first result or null
  async queryFirst(sql: string, params: any[] = []): Promise<any | null> {
    const result = await this.db.prepare(sql).bind(...params).first();
    return result || null;
  }

  // Execute method for INSERT/UPDATE/DELETE operations
  async execute(sql: string, params: any[] = []): Promise<{ success: boolean; meta: any }> {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      return {
        success: result.success || true,
        meta: result.meta || { changes: result.changes || 0 }
      };
    } catch (error) {
      console.error('Database execute error:', error);
      return {
        success: false,
        meta: { error: error.message }
      };
    }
  }

  // Utility method to check if database is healthy
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.db.prepare('SELECT 1').first();
      return result !== null;
    } catch {
      return false;
    }
  }
}