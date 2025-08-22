import { DatabaseService } from './database';
import { createError } from '../middleware/error';

export interface Activity {
  id: string;
  user_id: string;
  action: 'uploaded' | 'created' | 'processed' | 'viewed' | 'completed' | 'updated' | 'deleted';
  resource_type: 'document' | 'audio' | 'note' | 'flashcard' | 'study-guide' | 'assignment' | 'course';
  resource_id: string;
  resource_title: string;
  course_id?: string;
  course_name?: string;
  course_color?: string;
  course_code?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface RecentItem {
  id: string;
  title: string;
  type: 'document' | 'note' | 'study-guide' | 'flashcard' | 'assignment';
  course?: {
    id: string;
    name: string;
    color: string;
    code: string;
  };
  lastAccessed: Date;
  progress?: number;
}

export class ActivityService {
  constructor(private dbService: DatabaseService) {}

  async createActivityTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS user_activities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        resource_title TEXT NOT NULL,
        course_id TEXT,
        course_name TEXT,
        course_color TEXT,
        course_code TEXT,
        metadata TEXT, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON user_activities(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activities_created_at ON user_activities(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_activities_resource_type ON user_activities(resource_type);
      CREATE INDEX IF NOT EXISTS idx_user_activities_action ON user_activities(action);
    `;
    
    await this.dbService.query(sql);
  }

  async logActivity(
    userId: string,
    action: Activity['action'],
    resourceType: Activity['resource_type'],
    resourceId: string,
    resourceTitle: string,
    options?: {
      courseId?: string;
      courseName?: string;
      courseColor?: string;
      courseCode?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const activityId = crypto.randomUUID();
      
      const sql = `
        INSERT INTO user_activities (
          id, user_id, action, resource_type, resource_id, resource_title,
          course_id, course_name, course_color, course_code, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.dbService.query(sql, [
        activityId,
        userId,
        action,
        resourceType,
        resourceId,
        resourceTitle,
        options?.courseId || null,
        options?.courseName || null,
        options?.courseColor || null,
        options?.courseCode || null,
        options?.metadata ? JSON.stringify(options.metadata) : null,
        new Date().toISOString()
      ]);
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw error - activity logging shouldn't break main functionality
    }
  }

  async getRecentActivities(
    userId: string,
    limit: number = 10,
    actions?: Activity['action'][]
  ): Promise<Activity[]> {
    try {
      let sql = `
        SELECT * FROM user_activities 
        WHERE user_id = ?
      `;
      
      const params: any[] = [userId];
      
      if (actions && actions.length > 0) {
        sql += ` AND action IN (${actions.map(() => '?').join(',')})`;
        params.push(...actions);
      }
      
      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);
      
      const result = await this.dbService.query(sql, params);
      return (result.results as Activity[]) || [];
    } catch (error) {
      console.error('Failed to get recent activities:', error);
      // Return empty array instead of throwing to handle gracefully
      return [];
    }
  }

  async getRecentlyAccessedItems(userId: string, limit: number = 5): Promise<RecentItem[]> {
    try {
      // Get recently viewed/accessed documents and other resources
      const sql = `
        SELECT 
          ua.resource_id as id,
          ua.resource_title as title,
          ua.resource_type as type,
          ua.course_id,
          ua.course_name,
          ua.course_color,
          ua.course_code,
          MAX(ua.created_at) as last_accessed,
          NULL as progress
        FROM user_activities ua
        WHERE ua.user_id = ? 
        AND ua.action IN ('viewed', 'processed', 'completed', 'updated')
        AND ua.resource_type IN ('document', 'note', 'study-guide', 'flashcard', 'assignment')
        GROUP BY ua.resource_id, ua.resource_type
        ORDER BY last_accessed DESC
        LIMIT ?
      `;
      
      const result = await this.dbService.query(sql, [userId, limit]);
      const items = (result.results as any[]) || [];
      
      return items.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        course: item.course_id ? {
          id: item.course_id,
          name: item.course_name || 'Unknown Course',
          color: item.course_color || '#4A7C2A',
          code: item.course_code || 'COURSE'
        } : undefined,
        lastAccessed: item.last_accessed, // Keep as string for JSON serialization
        progress: item.progress
      }));
    } catch (error) {
      console.error('Failed to get recently accessed items:', error);
      // Return empty array instead of throwing to handle gracefully
      return [];
    }
  }

  async getActivityStats(userId: string, days: number = 7): Promise<{
    totalActivities: number;
    documentsUploaded: number;
    itemsCreated: number;
    audioProcessed: number;
    documentsViewed: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const sql = `
        SELECT 
          COUNT(*) as total_activities,
          SUM(CASE WHEN action = 'uploaded' AND resource_type = 'document' THEN 1 ELSE 0 END) as documents_uploaded,
          SUM(CASE WHEN action IN ('created', 'generated') THEN 1 ELSE 0 END) as items_created,
          SUM(CASE WHEN action = 'processed' AND resource_type = 'audio' THEN 1 ELSE 0 END) as audio_processed,
          SUM(CASE WHEN action = 'viewed' AND resource_type = 'document' THEN 1 ELSE 0 END) as documents_viewed
        FROM user_activities
        WHERE user_id = ? AND created_at >= ?
      `;
      
      const result = await this.dbService.query(sql, [userId, startDate.toISOString()]);
      const stats = (result.results?.[0] as any) || {};
      
      return {
        totalActivities: Number(stats.total_activities) || 0,
        documentsUploaded: Number(stats.documents_uploaded) || 0,
        itemsCreated: Number(stats.items_created) || 0,
        audioProcessed: Number(stats.audio_processed) || 0,
        documentsViewed: Number(stats.documents_viewed) || 0
      };
    } catch (error) {
      console.error('Failed to get activity stats:', error);
      // Return default stats instead of throwing to handle gracefully
      return {
        totalActivities: 0,
        documentsUploaded: 0,
        itemsCreated: 0,
        audioProcessed: 0,
        documentsViewed: 0
      };
    }
  }

  // Helper method to log document activities with course context
  async logDocumentActivity(
    userId: string,
    action: Activity['action'],
    documentId: string,
    documentTitle: string,
    courseInfo?: { id: string; name: string; color?: string; code?: string }
  ): Promise<void> {
    await this.logActivity(userId, action, 'document', documentId, documentTitle, {
      courseId: courseInfo?.id,
      courseName: courseInfo?.name,
      courseColor: courseInfo?.color || '#4A7C2A',
      courseCode: courseInfo?.code || courseInfo?.name
    });
  }

  // Helper method to log assignment activities
  async logAssignmentActivity(
    userId: string,
    action: Activity['action'],
    assignmentId: string,
    assignmentTitle: string,
    courseInfo?: { id: string; name: string; color?: string; code?: string }
  ): Promise<void> {
    await this.logActivity(userId, action, 'assignment', assignmentId, assignmentTitle, {
      courseId: courseInfo?.id,
      courseName: courseInfo?.name,
      courseColor: courseInfo?.color || '#4A7C2A',
      courseCode: courseInfo?.code || courseInfo?.name
    });
  }

  // Helper method to log audio activities
  async logAudioActivity(
    userId: string,
    action: Activity['action'],
    audioId: string,
    audioTitle: string,
    courseInfo?: { id: string; name: string; color?: string; code?: string }
  ): Promise<void> {
    await this.logActivity(userId, action, 'audio', audioId, audioTitle, {
      courseId: courseInfo?.id,
      courseName: courseInfo?.name,
      courseColor: courseInfo?.color || '#4A7C2A',
      courseCode: courseInfo?.code || courseInfo?.name
    });
  }
}