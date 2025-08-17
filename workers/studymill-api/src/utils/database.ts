import { DatabaseService } from '../services/database';

export interface Migration {
  id: string;
  name: string;
  up: string; // SQL for applying migration
  down?: string; // SQL for rolling back migration (optional)
}

export class DatabaseManager {
  constructor(private db: D1Database) {}

  /**
   * Initialize the database with schema and seed data
   */
  async initialize(): Promise<void> {
    try {
      // Check if database is already initialized
      const isInitialized = await this.checkInitialization();
      if (isInitialized) {
        console.log('Database already initialized');
        return;
      }

      console.log('Initializing database...');
      
      // Apply schema from schema.sql file content
      await this.applySchema();
      
      // Mark as initialized
      await this.markInitialized();
      
      console.log('Database initialization complete');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if database is initialized
   */
  private async checkInitialization(): Promise<boolean> {
    try {
      // Check if users table exists and has expected structure
      const result = await this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='users'
      `).first();
      
      return result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Apply the database schema
   */
  private async applySchema(): Promise<void> {
    // This would normally read from schema.sql file
    // For now, we assume the schema is already applied via wrangler d1 execute
    console.log('Schema application handled by wrangler deployment');
  }

  /**
   * Mark database as initialized
   */
  private async markInitialized(): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT OR IGNORE INTO _cf_METADATA (key, value) 
      VALUES ('initialized_at', ?)
    `).bind(now).run();
  }

  /**
   * Seed the database with initial data
   */
  async seed(): Promise<void> {
    try {
      console.log('Seeding database with initial data...');
      
      // Add any seed data here
      // For example, default course categories, admin users, etc.
      
      console.log('Database seeding complete');
    } catch (error) {
      console.error('Database seeding failed:', error);
      throw error;
    }
  }

  /**
   * Validate database health and structure
   */
  async validate(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      // Check if all required tables exist
      const requiredTables = [
        'users', 'courses', 'documents', 'assignments', 
        'chat_sessions', 'chat_messages', 'flashcards', 
        'notes', 'document_chunks', 'study_sessions'
      ];
      
      for (const table of requiredTables) {
        const result = await this.db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `).bind(table).first();
        
        if (!result) {
          issues.push(`Missing table: ${table}`);
        }
      }
      
      // Check database connectivity
      const dbService = new DatabaseService(this.db);
      const isHealthy = await dbService.healthCheck();
      if (!isHealthy) {
        issues.push('Database connectivity check failed');
      }
      
      return {
        healthy: issues.length === 0,
        issues
      };
    } catch (error) {
      issues.push(`Validation error: ${error}`);
      return { healthy: false, issues };
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    tables: { name: string; count: number }[];
    totalRecords: number;
  }> {
    const tables = [
      'users', 'courses', 'documents', 'assignments',
      'chat_sessions', 'chat_messages', 'flashcards',
      'notes', 'document_chunks', 'study_sessions'
    ];
    
    const tableStats = [];
    let totalRecords = 0;
    
    for (const table of tables) {
      try {
        const result = await this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).first();
        const count = (result as any)?.count || 0;
        tableStats.push({ name: table, count });
        totalRecords += count;
      } catch (error) {
        tableStats.push({ name: table, count: -1 }); // -1 indicates error
      }
    }
    
    return {
      tables: tableStats,
      totalRecords
    };
  }

  /**
   * Clean up test data (useful for development)
   */
  async cleanupTestData(): Promise<void> {
    if (process.env.ENVIRONMENT !== 'development') {
      throw new Error('Cleanup only allowed in development environment');
    }
    
    console.log('Cleaning up test data...');
    
    // Clean up in reverse dependency order
    const cleanupOrder = [
      'study_sessions',
      'document_chunks', 
      'chat_messages',
      'chat_sessions',
      'flashcards',
      'notes',
      'assignments',
      'documents',
      'courses',
      'users'
    ];
    
    for (const table of cleanupOrder) {
      await this.db.prepare(`DELETE FROM ${table}`).run();
    }
    
    console.log('Test data cleanup complete');
  }
}

/**
 * Helper function to create database manager instance
 */
export function createDatabaseManager(db: D1Database): DatabaseManager {
  return new DatabaseManager(db);
}