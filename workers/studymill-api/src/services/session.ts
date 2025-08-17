import { AuthSession, User } from '../utils/auth';
import { createError } from '../middleware/error';

export class SessionService {
  private kv: KVNamespace | undefined;
  
  constructor(kv?: KVNamespace) {
    this.kv = kv;
  }
  
  /**
   * Store authentication session in KV
   */
  async createSession(user: User, token: string, refreshToken: string): Promise<AuthSession> {
    if (!this.kv) {
      console.warn('KV storage not available, session will not be persisted');
      // Return session object even if KV is not available
      const now = Date.now();
      return {
        userId: user.id,
        token,
        refreshToken,
        expiresAt: now + (24 * 60 * 60 * 1000), // 24 hours
        createdAt: now
      };
    }
    
    const now = Date.now();
    const session: AuthSession = {
      userId: user.id,
      token,
      refreshToken,
      expiresAt: now + (24 * 60 * 60 * 1000), // 24 hours
      createdAt: now
    };
    
    try {
      // Store session with token suffix as key for fast lookup
      const sessionKey = `session:${user.id}:${token.slice(-8)}`;
      const refreshKey = `refresh:${refreshToken}`;
      
      // Store session data (expires in 24 hours)
      await this.kv.put(sessionKey, JSON.stringify(session), {
        expirationTtl: 24 * 60 * 60 // 24 hours in seconds
      });
      
      // Store refresh token mapping (expires in 7 days)
      await this.kv.put(refreshKey, JSON.stringify({
        userId: user.id,
        sessionKey,
        createdAt: now,
        expiresAt: now + (7 * 24 * 60 * 60 * 1000) // 7 days
      }), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days in seconds
      });
      
      return session;
    } catch (error) {
      console.error('Session creation error:', error);
      // Don't fail the authentication if session storage fails
      return session;
    }
  }
  
  /**
   * Validate and retrieve session
   */
  async getSession(userId: string, tokenSuffix: string): Promise<AuthSession | null> {
    if (!this.kv) {
      return null;
    }
    
    try {
      const sessionKey = `session:${userId}:${tokenSuffix}`;
      const sessionData = await this.kv.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }
      
      const session: AuthSession = JSON.parse(sessionData);
      
      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        await this.invalidateSession(userId, tokenSuffix);
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Session retrieval error:', error);
      return null;
    }
  }
  
  /**
   * Invalidate a specific session
   */
  async invalidateSession(userId: string, tokenSuffix: string): Promise<void> {
    if (!this.kv) {
      return;
    }
    
    try {
      const sessionKey = `session:${userId}:${tokenSuffix}`;
      await this.kv.delete(sessionKey);
    } catch (error) {
      console.error('Session invalidation error:', error);
    }
  }
  
  /**
   * Invalidate all sessions for a user
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    if (!this.kv) {
      return;
    }
    
    try {
      // List all sessions for the user
      const sessionPrefix = `session:${userId}:`;
      const sessionsList = await this.kv.list({ prefix: sessionPrefix });
      
      // Delete all sessions
      const deletePromises = sessionsList.keys.map(key => 
        this.kv!.delete(key.name)
      );
      
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('All sessions invalidation error:', error);
    }
  }
  
  /**
   * Refresh access token using refresh token
   */
  async refreshSession(refreshToken: string): Promise<{ userId: string; sessionKey: string } | null> {
    if (!this.kv) {
      return null;
    }
    
    try {
      const refreshKey = `refresh:${refreshToken}`;
      const refreshData = await this.kv.get(refreshKey);
      
      if (!refreshData) {
        return null;
      }
      
      const refreshInfo = JSON.parse(refreshData);
      
      // Check if refresh token is expired
      if (refreshInfo.expiresAt < Date.now()) {
        await this.kv.delete(refreshKey);
        return null;
      }
      
      return {
        userId: refreshInfo.userId,
        sessionKey: refreshInfo.sessionKey
      };
    } catch (error) {
      console.error('Session refresh error:', error);
      return null;
    }
  }
  
  /**
   * Clean up expired sessions (maintenance function)
   */
  async cleanupExpiredSessions(): Promise<number> {
    if (!this.kv) {
      return 0;
    }
    
    try {
      let deletedCount = 0;
      const now = Date.now();
      
      // List all sessions
      const sessionsList = await this.kv.list({ prefix: 'session:' });
      
      for (const key of sessionsList.keys) {
        try {
          const sessionData = await this.kv.get(key.name);
          if (sessionData) {
            const session: AuthSession = JSON.parse(sessionData);
            if (session.expiresAt < now) {
              await this.kv.delete(key.name);
              deletedCount++;
            }
          }
        } catch (error) {
          // Delete corrupted session data
          await this.kv.delete(key.name);
          deletedCount++;
        }
      }
      
      // Clean up expired refresh tokens
      const refreshList = await this.kv.list({ prefix: 'refresh:' });
      
      for (const key of refreshList.keys) {
        try {
          const refreshData = await this.kv.get(key.name);
          if (refreshData) {
            const refreshInfo = JSON.parse(refreshData);
            if (refreshInfo.expiresAt < now) {
              await this.kv.delete(key.name);
              deletedCount++;
            }
          }
        } catch (error) {
          // Delete corrupted refresh data
          await this.kv.delete(key.name);
          deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }
  }
  
  /**
   * Get session statistics for monitoring
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    totalRefreshTokens: number;
    activeSessions: number;
  }> {
    if (!this.kv) {
      return { totalSessions: 0, totalRefreshTokens: 0, activeSessions: 0 };
    }
    
    try {
      const now = Date.now();
      let totalSessions = 0;
      let activeSessions = 0;
      
      // Count sessions
      const sessionsList = await this.kv.list({ prefix: 'session:' });
      totalSessions = sessionsList.keys.length;
      
      // Count active sessions
      for (const key of sessionsList.keys) {
        try {
          const sessionData = await this.kv.get(key.name);
          if (sessionData) {
            const session: AuthSession = JSON.parse(sessionData);
            if (session.expiresAt > now) {
              activeSessions++;
            }
          }
        } catch (error) {
          // Skip corrupted sessions
        }
      }
      
      // Count refresh tokens
      const refreshList = await this.kv.list({ prefix: 'refresh:' });
      const totalRefreshTokens = refreshList.keys.length;
      
      return {
        totalSessions,
        totalRefreshTokens,
        activeSessions
      };
    } catch (error) {
      console.error('Session stats error:', error);
      return { totalSessions: 0, totalRefreshTokens: 0, activeSessions: 0 };
    }
  }
}