import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { apiRoutes } from './routes/api';
import { errorHandler } from './middleware/error';
import { securityHeaders, secureCORS } from './middleware/security';
import { ChatDurableObject } from './durable-objects/ChatDurableObject';

type Bindings = {
  // Database bindings
  DB: D1Database;
  
  // Storage bindings
  BUCKET: R2Bucket;
  KV: KVNamespace;
  VECTORIZE: VectorizeIndex;
  
  // Durable Objects
  CHAT_DO: DurableObjectNamespace;
  
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

// Dev-only: warn if critical tables are missing (surface missing migrations early)
let __devTableCheckDone = false;
app.use('*', async (c, next) => {
  try {
    if (!__devTableCheckDone && c.env?.ENVIRONMENT === 'development') {
      // Check for user_ai_preferences table presence
      const row = await c.env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='user_ai_preferences'"
      ).first();
      if (!row) {
        console.warn('[DEV] D1 table missing: user_ai_preferences. Run Phase 0 migration: migrations/20250910_user_ai_preferences.sql');
      }
      __devTableCheckDone = true;
    }
  } catch (e) {
    // Non-fatal; continue
  }
  return next();
});

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
    // Be permissive for our known environments, including all CF Pages previews
    if (!origin) return true; // same-origin or non-browser clients

    // Local development
    const localhostOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];
    if (localhostOrigins.some((o) => origin.startsWith(o))) return true;

    // Primary domains
    const staticAllowed = [
      'https://studymill.ai',
      'https://www.studymill.ai',
      'https://studymill-frontend.pages.dev',
      'https://studymill.pages.dev'
    ];
    if (staticAllowed.some((o) => origin.startsWith(o))) return true;

    // Any Cloudflare Pages preview subdomain
    if (origin.includes('.studymill-frontend.pages.dev') || origin.includes('.studymill.pages.dev')) {
      return true;
    }

    // Block everything else
    return false;
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

// Backward-compat redirect for legacy chat paths (avoid 404s)
app.use('/chat/*', async (c, next) => {
  // Preserve query string
  const url = new URL(c.req.url);
  const redirected = `/api/v1${url.pathname}${url.search}`;

  // Structured server log for visibility
  try {
    const ts = new Date().toISOString();
    const sessionId = url.searchParams.get('sessionId');
    console.log(
      JSON.stringify({
        event: 'legacy_chat_redirect',
        ts,
        path: url.pathname,
        redirected,
        sessionId: sessionId || null
      })
    );
  } catch {}

  return c.redirect(redirected, 308);
});

// API routes
app.route('/auth', authRoutes);
app.route('/api/v1', apiRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

export default app;
export { ChatDurableObject };
