import { Context, Next } from 'hono';
import { AuthUtils, AuthTokenPayload } from '../utils/auth';
import { createError } from './error';

// Extend Hono's context to include user information
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthTokenPayload;
    userId: string;
  }
}

/**
 * Authentication middleware that verifies JWT tokens
 * Adds user information to context for use in protected routes
 */
export const authMiddleware = async (c: Context, next: Next) => {
  try {
    // Extract token from Authorization header
    const authHeader = c.req.header('Authorization');
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    
    if (!token) {
      createError('Authorization token required', 401, {
        code: 'MISSING_TOKEN',
        message: 'Please provide a valid authorization token'
      });
    }
    
    // Get JWT secret from environment
    const jwtSecret = c.env?.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured in environment');
      createError('Authentication service unavailable', 500);
    }
    
    // Verify the token
    const payload = await AuthUtils.verifyAccessToken(token, jwtSecret);
    
    // Check if session exists in KV store (optional session validation)
    const sessionKey = `session:${payload.sub}:${token.slice(-8)}`;
    if (c.env?.KV) {
      const session = await c.env.KV.get(sessionKey);
      if (!session) {
        createError('Session expired or invalid', 401, {
          code: 'INVALID_SESSION',
          message: 'Please log in again'
        });
      }
    }
    
    // Add user information to context
    c.set('user', payload);
    c.set('userId', payload.sub);
    
    await next();
  } catch (error) {
    // Re-throw AppError instances
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    
    // Handle other authentication errors
    console.error('Authentication middleware error:', error);
    createError('Authentication failed', 401);
  }
};

/**
 * Optional authentication middleware
 * Adds user information to context if token is present, but doesn't require it
 */
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = AuthUtils.extractTokenFromHeader(authHeader);
    
    if (token) {
      const jwtSecret = c.env?.JWT_SECRET;
      if (jwtSecret) {
        try {
          const payload = await AuthUtils.verifyAccessToken(token, jwtSecret);
          c.set('user', payload);
          c.set('userId', payload.sub);
        } catch (error) {
          // Silently fail for optional auth
          console.warn('Optional auth token verification failed:', error);
        }
      }
    }
    
    await next();
  } catch (error) {
    // Continue without authentication for optional middleware
    console.warn('Optional authentication middleware error:', error);
    await next();
  }
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimitMiddleware = async (c: Context, next: Next) => {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') || 
                    c.req.header('X-Forwarded-For') || 
                    'unknown';
    
    const rateLimitKey = `auth_rate_limit:${clientIP}`;
    
    if (c.env?.KV) {
      // Check current rate limit
      const currentCount = await c.env.KV.get(rateLimitKey);
      const count = currentCount ? parseInt(currentCount) : 0;
      
      // Allow 5 attempts per 15 minutes
      const maxAttempts = 5;
      const windowMinutes = 15;
      
      if (count >= maxAttempts) {
        createError('Too many authentication attempts', 429, {
          code: 'RATE_LIMITED',
          message: `Too many attempts. Please try again in ${windowMinutes} minutes.`,
          retryAfter: windowMinutes * 60
        });
      }
      
      // Increment counter
      await c.env.KV.put(
        rateLimitKey, 
        (count + 1).toString(), 
        { expirationTtl: windowMinutes * 60 }
      );
    }
    
    await next();
  } catch (error) {
    // Re-throw AppError instances
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    
    console.error('Auth rate limit middleware error:', error);
    await next(); // Continue if rate limiting fails
  }
};

/**
 * Permission-based middleware for role checking
 * TODO: Implement when user roles are added to the system
 */
export const requirePermission = (permission: string) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user) {
      createError('Authentication required', 401);
    }
    
    // TODO: Implement permission checking logic
    // For now, all authenticated users have all permissions
    
    await next();
  };
};