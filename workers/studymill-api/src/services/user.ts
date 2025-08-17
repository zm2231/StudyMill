import { User, AuthUtils } from '../utils/auth';
import { createError } from '../middleware/error';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export class UserService {
  private db: D1Database | undefined;
  
  constructor(db?: D1Database) {
    this.db = db;
  }
  
  /**
   * Create a new user account
   */
  async createUser(userData: CreateUserData): Promise<User> {
    if (!this.db) {
      createError('Database not available', 500);
    }
    
    const { email, password, name } = userData;
    
    // Validate input
    if (!AuthUtils.validateEmail(email)) {
      createError('Invalid email format', 400, { field: 'email' });
    }
    
    const passwordValidation = AuthUtils.validatePassword(password);
    if (!passwordValidation.valid) {
      createError('Invalid password', 400, { 
        field: 'password', 
        errors: passwordValidation.errors 
      });
    }
    
    if (!name || name.trim().length < 1) {
      createError('Name is required', 400, { field: 'name' });
    }
    
    // Check if user already exists
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      createError('User already exists with this email', 409, { 
        field: 'email',
        code: 'USER_EXISTS'
      });
    }
    
    // Hash password
    const hashedPassword = await AuthUtils.hashPassword(password);
    
    // Generate user ID
    const userId = AuthUtils.generateUserId();
    const now = new Date().toISOString();
    
    try {
      // Insert user into database
      const result = await this.db!.prepare(`
        INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(userId, email.toLowerCase(), name.trim(), hashedPassword, now, now).run();
      
      if (!result.success) {
        console.error('Database insert failed:', result.error);
        createError('Failed to create user account', 500);
      }
      
      // Return user without password
      return {
        id: userId,
        email: email.toLowerCase(),
        name: name.trim(),
        created_at: now,
        updated_at: now
      };
    } catch (error) {
      console.error('User creation error:', error);
      createError('Failed to create user account', 500);
    }
  }
  
  /**
   * Authenticate user login
   */
  async authenticateUser(credentials: LoginCredentials): Promise<User> {
    if (!this.db) {
      createError('Database not available', 500);
    }
    
    const { email, password } = credentials;
    
    if (!email || !password) {
      createError('Email and password are required', 400);
    }
    
    try {
      // Find user by email
      const result = await this.db!.prepare(`
        SELECT id, email, name, password_hash, created_at, updated_at
        FROM users 
        WHERE email = ?
      `).bind(email.toLowerCase()).first();
      
      if (!result) {
        createError('Invalid email or password', 401, { 
          code: 'INVALID_CREDENTIALS' 
        });
      }
      
      // Verify password
      const passwordValid = await AuthUtils.verifyPassword(
        password, 
        result.password_hash as string
      );
      
      if (!passwordValid) {
        createError('Invalid email or password', 401, { 
          code: 'INVALID_CREDENTIALS' 
        });
      }
      
      // Return user without password hash
      return {
        id: result.id as string,
        email: result.email as string,
        name: result.name as string,
        created_at: result.created_at as string,
        updated_at: result.updated_at as string
      };
    } catch (error) {
      // Re-throw AppError instances
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }
      
      console.error('User authentication error:', error);
      createError('Authentication failed', 500);
    }
  }
  
  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    if (!this.db) {
      return null;
    }
    
    try {
      const result = await this.db.prepare(`
        SELECT id, email, name, created_at, updated_at
        FROM users 
        WHERE email = ?
      `).bind(email.toLowerCase()).first();
      
      if (!result) {
        return null;
      }
      
      return {
        id: result.id as string,
        email: result.email as string,
        name: result.name as string,
        created_at: result.created_at as string,
        updated_at: result.updated_at as string
      };
    } catch (error) {
      console.error('Find user by email error:', error);
      return null;
    }
  }
  
  /**
   * Find user by ID
   */
  async findUserById(userId: string): Promise<User | null> {
    if (!this.db) {
      return null;
    }
    
    try {
      const result = await this.db.prepare(`
        SELECT id, email, name, created_at, updated_at
        FROM users 
        WHERE id = ?
      `).bind(userId).first();
      
      if (!result) {
        return null;
      }
      
      return {
        id: result.id as string,
        email: result.email as string,
        name: result.name as string,
        created_at: result.created_at as string,
        updated_at: result.updated_at as string
      };
    } catch (error) {
      console.error('Find user by ID error:', error);
      return null;
    }
  }
  
  /**
   * Update user information
   */
  async updateUser(userId: string, updates: Partial<Pick<User, 'name' | 'email'>>): Promise<User> {
    if (!this.db) {
      createError('Database not available', 500);
    }
    
    const { name, email } = updates;
    
    // Validate updates
    if (email && !AuthUtils.validateEmail(email)) {
      createError('Invalid email format', 400, { field: 'email' });
    }
    
    if (name !== undefined && name.trim().length < 1) {
      createError('Name cannot be empty', 400, { field: 'name' });
    }
    
    // Check if email is already taken by another user
    if (email) {
      const existingUser = await this.findUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        createError('Email already in use', 409, { 
          field: 'email',
          code: 'EMAIL_EXISTS'
        });
      }
    }
    
    try {
      const now = new Date().toISOString();
      
      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      
      if (name !== undefined) {
        updateFields.push('name = ?');
        values.push(name.trim());
      }
      
      if (email !== undefined) {
        updateFields.push('email = ?');
        values.push(email.toLowerCase());
      }
      
      updateFields.push('updated_at = ?');
      values.push(now);
      values.push(userId);
      
      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;
      
      const result = await this.db!.prepare(updateQuery).bind(...values).run();
      
      if (!result.success) {
        console.error('User update failed:', result.error);
        createError('Failed to update user', 500);
      }
      
      // Return updated user
      const updatedUser = await this.findUserById(userId);
      if (!updatedUser) {
        createError('User not found after update', 500);
      }
      
      return updatedUser!;
    } catch (error) {
      // Re-throw AppError instances
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }
      
      console.error('User update error:', error);
      createError('Failed to update user', 500);
    }
  }
  
  /**
   * Delete user account
   */
  async deleteUser(userId: string): Promise<void> {
    if (!this.db) {
      createError('Database not available', 500);
    }
    
    try {
      const result = await this.db!.prepare(`
        DELETE FROM users WHERE id = ?
      `).bind(userId).run();
      
      if (!result.success) {
        console.error('User deletion failed:', result.error);
        createError('Failed to delete user', 500);
      }
      
      if (result.changes === 0) {
        createError('User not found', 404);
      }
    } catch (error) {
      // Re-throw AppError instances
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }
      
      console.error('User deletion error:', error);
      createError('Failed to delete user', 500);
    }
  }
}