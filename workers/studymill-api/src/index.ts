import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { apiRoutes } from './routes/api';
import { errorHandler } from './middleware/error';
import { securityHeaders, secureCORS } from './middleware/security';

type Bindings = {
  // Database bindings
  DB: D1Database;
  
  // Storage bindings
  BUCKET: R2Bucket;
  KV: KVNamespace;
  VECTORIZE: VectorizeIndex;
  
  // Environment variables
  JWT_SECRET: string;
  ENVIRONMENT: string;
  API_VERSION: string;
  FRONTEND_URL: string;
  
  // External API keys (secrets)
  GOOGLE_API_KEY: string;
  GROQ_API_KEY: string;
  PARSE_EXTRACT_API_KEY: string;
  GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Global middleware - Order matters for security
app.use('*', logger());

// Security headers (applied first)
app.use('*', securityHeaders());

// Secure CORS configuration
app.use('*', secureCORS());

// CSRF protection for state-changing operations
app.use('*', csrf({
  origin: (origin) => {
    // Allow same-origin requests and approved origins
    const allowedOrigins = [
      'http://localhost:3000',
      'https://studymill.ai',
      'https://www.studymill.ai',
      'https://studymill-frontend.pages.dev',
      'https://studymill.pages.dev',
      'https://a8b6094b.studymill-frontend.pages.dev'
    ];
    return !origin || allowedOrigins.some(allowed => origin.startsWith(allowed));
  }
}));

// Error handling
app.onError(errorHandler);

// Health check
app.get('/', async (c) => {
  const dbHealthy = c.env?.DB ? await checkDatabaseHealth(c.env.DB) : false;
  
  return c.json({
    message: 'StudyMill API v1.0',
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'healthy' : 'unavailable'
    }
  });
});

// Database health check helper
async function checkDatabaseHealth(db: D1Database): Promise<boolean> {
  try {
    const result = await db.prepare('SELECT 1').first();
    return result !== null;
  } catch {
    return false;
  }
}

// API routes
app.route('/auth', authRoutes);
app.route('/api/v1', apiRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

export default app;
