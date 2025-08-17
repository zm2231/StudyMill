import { AuthUtils } from '../utils/auth';

export interface Course {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCourseData {
  name: string;
  description?: string;
}

export interface UpdateCourseData {
  name?: string;
  description?: string;
}

export class DatabaseService {
  constructor(public db: D1Database) {}

  // Course operations
  async createCourse(userId: string, data: CreateCourseData): Promise<Course> {
    const id = 'course_' + crypto.randomUUID();
    const now = new Date().toISOString();
    
    const result = await this.db.prepare(`
      INSERT INTO courses (id, user_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, userId, data.name, data.description || null, now, now).run();

    if (!result.success) {
      throw new Error('Failed to create course');
    }

    return {
      id,
      user_id: userId,
      name: data.name,
      description: data.description,
      created_at: now,
      updated_at: now
    };
  }

  async getCoursesByUserId(userId: string): Promise<Course[]> {
    const result = await this.db.prepare(`
      SELECT * FROM courses 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).bind(userId).all();

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

    const result = await this.db.prepare(`
      UPDATE courses 
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(name, description, now, courseId, userId).run();

    if (!result.success) {
      throw new Error('Failed to update course');
    }

    return {
      id: courseId,
      user_id: userId,
      name,
      description,
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

  async getCourseCount(userId: string): Promise<number> {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count FROM courses WHERE user_id = ?
    `).bind(userId).first();

    return (result as any)?.count || 0;
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