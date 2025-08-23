/**
 * Security Headers Middleware
 * Implements essential security headers to protect against common attacks
 */

import { Context, Next } from 'hono';

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  // Content Security Policy - Prevents XSS attacks
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for development
    "style-src 'self' 'unsafe-inline'", // Allow inline styles for Mantine
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; '),

  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Force HTTPS in production
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // XSS Protection (legacy but still useful)
  'X-XSS-Protection': '1; mode=block',

  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Disable potentially dangerous browser features
  'Permissions-Policy': [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'speaker=()',
    'vibrate=()',
    'fullscreen=()',
    'sync-xhr=()'
  ].join(', '),

  // Prevent caching of sensitive responses
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Pragma': 'no-cache',
  'Expires': '0'
} as const;

/**
 * Development-specific headers (more permissive)
 */
export const DEV_SECURITY_HEADERS = {
  ...SECURITY_HEADERS,
  // More permissive CSP for development
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' localhost:* 127.0.0.1:*",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self' https: http: ws: wss:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  
  // Allow caching in development
  'Cache-Control': 'no-cache'
} as const;

/**
 * Security headers middleware
 * Adds essential security headers to all responses
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    // Apply headers before processing the request
    await next();

    // Determine if we're in development environment
    const isDevelopment = c.env?.ENVIRONMENT === 'development' || 
                         c.env?.NODE_ENV === 'development';

    // Choose appropriate headers
    const headers = isDevelopment ? DEV_SECURITY_HEADERS : SECURITY_HEADERS;

    // Apply security headers to the response
    Object.entries(headers).forEach(([key, value]) => {
      c.res.headers.set(key, value);
    });

    // Add security-related headers based on response type
    const contentType = c.res.headers.get('Content-Type');
    
    // For JSON responses, ensure no-sniff
    if (contentType?.includes('application/json')) {
      c.res.headers.set('X-Content-Type-Options', 'nosniff');
    }

    // For HTML responses, add additional XSS protection
    if (contentType?.includes('text/html')) {
      c.res.headers.set('X-XSS-Protection', '1; mode=block');
    }
  };
}

/**
 * CORS security middleware
 * Implements secure CORS configuration
 */
export function secureCORS() {
  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');
    const isDevelopment = c.env?.ENVIRONMENT === 'development';

    // Define allowed origins based on environment
    const allowedOrigins = [
      'https://studymill.ai',
      'https://www.studymill.ai',
      'https://studymill-frontend.pages.dev',
      'https://studymill.pages.dev',
      'https://a8b6094b.studymill-frontend.pages.dev'
        ];

    // Add custom domains from environment
    const customOrigin = c.env?.FRONTEND_URL;
    if (customOrigin && !allowedOrigins.includes(customOrigin)) {
      allowedOrigins.push(customOrigin);
    }

    // Check if origin is allowed
    const isAllowedOrigin = !origin || allowedOrigins.includes(origin);

    if (isAllowedOrigin) {
      c.res.headers.set('Access-Control-Allow-Origin', origin || '*');
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
      c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      c.res.headers.set('Access-Control-Allow-Headers', 
        'Content-Type, Authorization, X-Requested-With, Accept, Origin'
      );
      c.res.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    }

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    await next();
  };
}

/**
 * Rate limiting headers
 * Adds rate limiting information to responses
 */
export function rateLimitHeaders(limit: number, remaining: number, resetTime: number) {
  return (c: Context) => {
    c.res.headers.set('X-RateLimit-Limit', limit.toString());
    c.res.headers.set('X-RateLimit-Remaining', remaining.toString());
    c.res.headers.set('X-RateLimit-Reset', resetTime.toString());
  };
}