import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createError } from '../middleware/error';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenPayload {
  sub: string; // user_id
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export interface AuthSession {
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: number;
  createdAt: number;
}

export class AuthUtils {
  private static readonly SALT_ROUNDS = 12;
  private static readonly TOKEN_EXPIRY = '24h';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';
  
  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 6) {
      createError('Password must be at least 6 characters', 400);
    }
    
    try {
      const salt = await bcrypt.genSalt(this.SALT_ROUNDS);
      return bcrypt.hash(password, salt);
    } catch (error) {
      console.error('Password hashing error:', error);
      createError('Password hashing failed', 500);
    }
  }
  
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }
  
  static generateAccessToken(user: User, jwtSecret: string): string {
    if (!jwtSecret) {
      createError('JWT secret not configured', 500);
    }
    
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      iat: Math.floor(Date.now() / 1000),
    };
    
    try {
      return jwt.sign(payload, jwtSecret, { 
        algorithm: 'HS256',
        expiresIn: this.TOKEN_EXPIRY
      });
    } catch (error) {
      console.error('Token generation error:', error);
      createError('Token generation failed', 500);
    }
  }
  
  static generateRefreshToken(): string {
    // Generate a secure random refresh token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  static async verifyAccessToken(token: string, jwtSecret: string): Promise<AuthTokenPayload> {
    if (!jwtSecret) {
      createError('JWT secret not configured', 500);
    }
    
    try {
      const decoded = jwt.verify(token, jwtSecret, { 
        algorithms: ['HS256'] 
      }) as AuthTokenPayload;
      
      // Check if token is expired
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        createError('Token expired', 401);
      }
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        createError('Token expired', 401);
      } else if (error instanceof jwt.JsonWebTokenError) {
        createError('Invalid token', 401);
      } else {
        console.error('Token verification error:', error);
        createError('Token verification failed', 401);
      }
    }
  }
  
  static createAuthSession(user: User, token: string, refreshToken: string): AuthSession {
    const now = Date.now();
    return {
      userId: user.id,
      token,
      refreshToken,
      expiresAt: now + (24 * 60 * 60 * 1000), // 24 hours in milliseconds
      createdAt: now
    };
  }
  
  static generateUserId(): string {
    // Generate a UUID-like string for user ID
    return 'usr_' + crypto.randomUUID();
  }
  
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!password) {
      errors.push('Password is required');
    } else {
      if (password.length < 6) {
        errors.push('Password must be at least 6 characters long');
      }
      if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
      }
      if (!/[a-zA-Z]/.test(password)) {
        errors.push('Password must contain at least one letter');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    
    return parts[1];
  }
}