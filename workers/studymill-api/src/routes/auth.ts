import { Hono } from 'hono';
import { createError } from '../middleware/error';
import { authMiddleware, authRateLimitMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { UserService } from '../services/user';
import { SessionService } from '../services/session';
import { AuthUtils } from '../utils/auth';

export const authRoutes = new Hono();

// Apply rate limiting to auth endpoints
authRoutes.use('/register', authRateLimitMiddleware);
authRoutes.use('/login', authRateLimitMiddleware);

// POST /auth/register
authRoutes.post('/register', async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    // Validation
    if (!email || !password || !name) {
      createError('Missing required fields', 400, {
        required: ['email', 'password', 'name']
      });
    }

    // Initialize services
    const userService = new UserService(c.env?.DB);
    const sessionService = new SessionService(c.env?.KV);

    // Create user
    const user = await userService.createUser({ email, password, name });

    // Generate tokens
    const jwtSecret = c.env?.JWT_SECRET;
    if (!jwtSecret) {
      createError('Authentication service unavailable', 500);
    }

    const accessToken = AuthUtils.generateAccessToken(user, jwtSecret);
    const refreshToken = AuthUtils.generateRefreshToken();

    // Create session
    const session = await sessionService.createSession(user, accessToken, refreshToken);

    // Return success response
    return c.json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: session.expiresAt,
        token_type: 'Bearer'
      }
    }, 201);
  } catch (error) {
    throw error;
  }
});

// POST /auth/login
authRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    // Validation
    if (!email || !password) {
      createError('Email and password required', 400);
    }

    // Initialize services
    const userService = new UserService(c.env?.DB);
    const sessionService = new SessionService(c.env?.KV);

    // Authenticate user
    const user = await userService.authenticateUser({ email, password });

    // Generate tokens
    const jwtSecret = c.env?.JWT_SECRET;
    if (!jwtSecret) {
      createError('Authentication service unavailable', 500);
    }

    const accessToken = AuthUtils.generateAccessToken(user, jwtSecret);
    const refreshToken = AuthUtils.generateRefreshToken();

    // Create session
    const session = await sessionService.createSession(user, accessToken, refreshToken);

    // Return success response
    return c.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: session.expiresAt,
        token_type: 'Bearer'
      }
    });
  } catch (error) {
    throw error;
  }
});

// POST /auth/logout
authRoutes.post('/logout', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const authHeader = c.req.header('Authorization');
    const token = AuthUtils.extractTokenFromHeader(authHeader);

    if (token && user) {
      const sessionService = new SessionService(c.env?.KV);
      const tokenSuffix = token.slice(-8);
      await sessionService.invalidateSession(user.sub, tokenSuffix);
    }

    return c.json({
      message: 'Logout successful'
    });
  } catch (error) {
    throw error;
  }
});

// POST /auth/logout-all
authRoutes.post('/logout-all', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (user) {
      const sessionService = new SessionService(c.env?.KV);
      await sessionService.invalidateAllUserSessions(user.sub);
    }

    return c.json({
      message: 'All sessions logged out successfully'
    });
  } catch (error) {
    throw error;
  }
});

// GET /auth/me
authRoutes.get('/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const userService = new UserService(c.env?.DB);

    // Get fresh user data from database
    const currentUser = await userService.findUserById(user.sub);
    
    if (!currentUser) {
      createError('User not found', 404);
    }

    return c.json({
      user: {
        id: currentUser!.id,
        email: currentUser!.email,
        name: currentUser!.name,
        created_at: currentUser!.created_at,
        updated_at: currentUser!.updated_at
      }
    });
  } catch (error) {
    throw error;
  }
});

// PUT /auth/me
authRoutes.put('/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { name, email } = await c.req.json();
    
    if (!name && !email) {
      createError('No updates provided', 400);
    }

    const userService = new UserService(c.env?.DB);
    const updatedUser = await userService.updateUser(user.sub, { name, email });

    return c.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });
  } catch (error) {
    throw error;
  }
});

// POST /auth/refresh
authRoutes.post('/refresh', async (c) => {
  try {
    const { refresh_token } = await c.req.json();

    if (!refresh_token) {
      createError('Refresh token required', 400);
    }

    const sessionService = new SessionService(c.env?.KV);
    const refreshInfo = await sessionService.refreshSession(refresh_token);

    if (!refreshInfo) {
      createError('Invalid or expired refresh token', 401);
    }

    const userService = new UserService(c.env?.DB);
    const user = await userService.findUserById(refreshInfo.userId);

    if (!user) {
      createError('User not found', 404);
    }

    // Generate new tokens
    const jwtSecret = c.env?.JWT_SECRET;
    if (!jwtSecret) {
      createError('Authentication service unavailable', 500);
    }

    const newAccessToken = AuthUtils.generateAccessToken(user, jwtSecret);
    const newRefreshToken = AuthUtils.generateRefreshToken();

    // Create new session
    const session = await sessionService.createSession(user, newAccessToken, newRefreshToken);

    return c.json({
      message: 'Token refreshed successfully',
      tokens: {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: session.expiresAt,
        token_type: 'Bearer'
      }
    });
  } catch (error) {
    throw error;
  }
});

// DELETE /auth/account
authRoutes.delete('/account', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    const userService = new UserService(c.env?.DB);
    const sessionService = new SessionService(c.env?.KV);

    // Invalidate all sessions first
    await sessionService.invalidateAllUserSessions(user.sub);

    // Delete user account
    await userService.deleteUser(user.sub);

    return c.json({
      message: 'Account deleted successfully'
    });
  } catch (error) {
    throw error;
  }
});

// GET /auth/sessions (Admin/Debug endpoint)
authRoutes.get('/sessions', authMiddleware, async (c) => {
  try {
    const sessionService = new SessionService(c.env?.KV);
    const stats = await sessionService.getSessionStats();

    return c.json({
      message: 'Session statistics',
      stats
    });
  } catch (error) {
    throw error;
  }
});