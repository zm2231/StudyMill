import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { apiRoutes } from './routes/api';
import { errorHandler } from './middleware/error';

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

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://studymill.ai'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
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
