import { DatabaseService } from './database';
import { createError } from '../middleware/error';

export interface Assignment {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  assignment_type: 'homework' | 'test' | 'project' | 'quiz';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  created_at: string;
  updated_at: string;
}

export interface CreateAssignmentData {
  title: string;
  description?: string;
  dueDate?: string;
  assignmentType?: 'homework' | 'test' | 'project' | 'quiz';
  status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

export interface UpdateAssignmentData {
  title?: string;
  description?: string;
  dueDate?: string;
  assignmentType?: 'homework' | 'test' | 'project' | 'quiz';
  status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
}

export class AssignmentService {
  constructor(private dbService: DatabaseService) {}

  async getUserAssignments(
    userId: string,
    courseId?: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ assignments: Assignment[]; total: number }> {
    try {
      let whereConditions = ['user_id = ?'];
      let params: any[] = [userId];
      
      if (courseId) {
        whereConditions.push('course_id = ?');
        params.push(courseId);
      }
      
      if (status) {
        whereConditions.push('status = ?');
        params.push(status);
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Get assignments with course information
      const sql = `
        SELECT 
          a.*,
          c.name as course_name,
          c.description as course_description
        FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.id
        WHERE ${whereClause}
        ORDER BY a.due_date ASC, a.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      params.push(limit, offset);
      
      const result = await this.dbService.query(sql, params);
      const assignments = result.results as Assignment[];
      
      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM assignments WHERE ${whereClause}`;
      const countResult = await this.dbService.query(countSql, params.slice(0, -2));
      const total = (countResult.results?.[0] as any)?.total || 0;
      
      return { assignments, total };
    } catch (error) {
      console.error('Failed to get user assignments:', error);
      throw error;
    }
  }

  async getAssignment(assignmentId: string, userId: string): Promise<Assignment> {
    try {
      const sql = `
        SELECT 
          a.*,
          c.name as course_name,
          c.description as course_description
        FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.id
        WHERE a.id = ? AND a.user_id = ?
      `;
      
      const result = await this.dbService.query(sql, [assignmentId, userId]);
      const assignment = result.results?.[0] as Assignment;
      
      if (!assignment) {
        createError('Assignment not found', 404);
      }
      
      return assignment;
    } catch (error) {
      console.error('Failed to get assignment:', error);
      throw error;
    }
  }

  async createAssignment(
    userId: string,
    courseId: string,
    data: CreateAssignmentData
  ): Promise<Assignment> {
    try {
      const assignmentId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      // Validate course ownership
      const courseCheck = await this.dbService.query(
        'SELECT id FROM courses WHERE id = ? AND user_id = ?',
        [courseId, userId]
      );
      
      if (!courseCheck.results?.length) {
        createError('Course not found or access denied', 404);
      }
      
      // Determine status based on due date
      let status = data.status || 'pending';
      if (data.dueDate && new Date(data.dueDate) < new Date()) {
        status = 'overdue';
      }
      
      const sql = `
        INSERT INTO assignments (
          id, course_id, user_id, title, description, 
          due_date, assignment_type, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.dbService.query(sql, [
        assignmentId,
        courseId,
        userId,
        data.title,
        data.description || null,
        data.dueDate || null,
        data.assignmentType || 'homework',
        status,
        now,
        now
      ]);
      
      // Return the created assignment
      return await this.getAssignment(assignmentId, userId);
    } catch (error) {
      console.error('Failed to create assignment:', error);
      throw error;
    }
  }

  async updateAssignment(
    assignmentId: string,
    userId: string,
    data: UpdateAssignmentData
  ): Promise<Assignment> {
    try {
      // Check if assignment exists and belongs to user
      const existing = await this.getAssignment(assignmentId, userId);
      
      const updateFields: string[] = [];
      const params: any[] = [];
      
      if (data.title !== undefined) {
        updateFields.push('title = ?');
        params.push(data.title);
      }
      
      if (data.description !== undefined) {
        updateFields.push('description = ?');
        params.push(data.description);
      }
      
      if (data.dueDate !== undefined) {
        updateFields.push('due_date = ?');
        params.push(data.dueDate);
      }
      
      if (data.assignmentType !== undefined) {
        updateFields.push('assignment_type = ?');
        params.push(data.assignmentType);
      }
      
      if (data.status !== undefined) {
        updateFields.push('status = ?');
        params.push(data.status);
      }
      
      if (updateFields.length === 0) {
        return existing; // No updates
      }
      
      updateFields.push('updated_at = ?');
      params.push(new Date().toISOString());
      
      params.push(assignmentId, userId);
      
      const sql = `
        UPDATE assignments 
        SET ${updateFields.join(', ')} 
        WHERE id = ? AND user_id = ?
      `;
      
      await this.dbService.query(sql, params);
      
      // Return updated assignment
      return await this.getAssignment(assignmentId, userId);
    } catch (error) {
      console.error('Failed to update assignment:', error);
      throw error;
    }
  }

  async deleteAssignment(assignmentId: string, userId: string): Promise<void> {
    try {
      // Check if assignment exists and belongs to user
      await this.getAssignment(assignmentId, userId);
      
      const sql = 'DELETE FROM assignments WHERE id = ? AND user_id = ?';
      await this.dbService.query(sql, [assignmentId, userId]);
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      throw error;
    }
  }

  async getDueAssignments(
    userId: string,
    daysAhead: number = 7,
    limit: number = 10
  ): Promise<Assignment[]> {
    try {
      const now = new Date();
      const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      
      const sql = `
        SELECT 
          a.*,
          c.name as course_name,
          c.description as course_description
        FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.id
        WHERE a.user_id = ? 
        AND a.status IN ('pending', 'in_progress')
        AND a.due_date IS NOT NULL
        AND a.due_date <= ?
        ORDER BY a.due_date ASC
        LIMIT ?
      `;
      
      const result = await this.dbService.query(sql, [
        userId,
        futureDate.toISOString(),
        limit
      ]);
      
      return (result.results as Assignment[]) || [];
    } catch (error) {
      console.error('Failed to get due assignments:', error);
      // Return empty array instead of throwing to handle gracefully
      return [];
    }
  }

  async getOverdueAssignments(userId: string): Promise<Assignment[]> {
    try {
      const now = new Date().toISOString();
      
      const sql = `
        SELECT 
          a.*,
          c.name as course_name,
          c.description as course_description
        FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.id
        WHERE a.user_id = ? 
        AND a.status IN ('pending', 'in_progress')
        AND a.due_date IS NOT NULL
        AND a.due_date < ?
        ORDER BY a.due_date ASC
      `;
      
      const result = await this.dbService.query(sql, [userId, now]);
      
      const assignments = (result.results as Assignment[]) || [];
      
      // Update overdue assignments' status
      if (assignments.length > 0) {
        const overdueIds = assignments.map(a => a.id);
        const updateSql = `
          UPDATE assignments 
          SET status = 'overdue', updated_at = ? 
          WHERE id IN (${overdueIds.map(() => '?').join(',')}) AND user_id = ?
        `;
        try {
          await this.dbService.query(updateSql, [now, ...overdueIds, userId]);
        } catch (updateError) {
          console.error('Failed to update overdue status:', updateError);
          // Don't fail the whole operation if status update fails
        }
      }
      
      return assignments;
    } catch (error) {
      console.error('Failed to get overdue assignments:', error);
      // Return empty array instead of throwing to handle gracefully
      return [];
    }
  }

  async getCourseAssignments(courseId: string, userId: string): Promise<Assignment[]> {
    try {
      const sql = `
        SELECT 
          a.*,
          c.name as course_name,
          c.description as course_description
        FROM assignments a
        LEFT JOIN courses c ON a.course_id = c.id
        WHERE a.course_id = ? AND a.user_id = ?
        ORDER BY a.due_date ASC, a.created_at DESC
      `;
      
      const result = await this.dbService.query(sql, [courseId, userId]);
      return result.results as Assignment[];
    } catch (error) {
      console.error('Failed to get course assignments:', error);
      throw error;
    }
  }

  async getAssignmentStats(userId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    dueToday: number;
    dueTomorrow: number;
    dueThisWeek: number;
  }> {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
          SUM(CASE WHEN due_date >= ? AND due_date < ? THEN 1 ELSE 0 END) as due_today,
          SUM(CASE WHEN due_date >= ? AND due_date < ? THEN 1 ELSE 0 END) as due_tomorrow,
          SUM(CASE WHEN due_date >= ? AND due_date < ? THEN 1 ELSE 0 END) as due_this_week
        FROM assignments
        WHERE user_id = ?
      `;
      
      const result = await this.dbService.query(sql, [
        today.toISOString(),
        tomorrow.toISOString(),
        tomorrow.toISOString(),
        new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        today.toISOString(),
        weekFromNow.toISOString(),
        userId
      ]);
      
      const stats = result.results?.[0] as any;
      
      return {
        total: stats.total || 0,
        pending: stats.pending || 0,
        inProgress: stats.in_progress || 0,
        completed: stats.completed || 0,
        overdue: stats.overdue || 0,
        dueToday: stats.due_today || 0,
        dueTomorrow: stats.due_tomorrow || 0,
        dueThisWeek: stats.due_this_week || 0
      };
    } catch (error) {
      console.error('Failed to get assignment stats:', error);
      throw error;
    }
  }
}