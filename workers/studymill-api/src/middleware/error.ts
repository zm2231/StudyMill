import { Context } from 'hono';

// STANDARDIZED ERROR SCHEMA - P1-009 compliance
export interface StandardError {
  code: string;           // "VALIDATION_ERROR", "UNAUTHORIZED", etc.
  message: string;        // Human-readable description
  details?: any;          // Additional context (validation errors)
  requestId: string;      // Correlation ID for debugging
  timestamp: string;      // ISO timestamp
}

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode = 500, code?: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code || this.getDefaultCode(statusCode);
    this.details = details;
  }

  private getDefaultCode(statusCode: number): string {
    switch (statusCode) {
      case 400: return 'VALIDATION_ERROR';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 413: return 'FILE_TOO_LARGE';
      case 429: return 'RATE_LIMITED';
      case 500: return 'INTERNAL_ERROR';
      default: return 'UNKNOWN_ERROR';
    }
  }
}

// Generate request ID for correlation
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Middleware to add request ID to context
export const requestIdMiddleware = async (c: Context, next: Function) => {
  const requestId = generateRequestId();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  
  await next();
};

export const errorHandler = (err: Error, c: Context) => {
  const requestId = c.get('requestId') || generateRequestId();
  const timestamp = new Date().toISOString();
  
  // Log error with request ID for correlation
  console.error(`[${requestId}] API Error:`, {
    message: err.message,
    stack: err.stack,
    timestamp
  });

  if (err instanceof AppError) {
    const standardError: StandardError = {
      code: err.code,
      message: err.message,
      details: err.details,
      requestId,
      timestamp
    };

    return c.json(standardError, err.statusCode);
  }

  // Handle Hono HTTP errors
  if ('status' in err && typeof err.status === 'number') {
    const standardError: StandardError = {
      code: err.status === 404 ? 'NOT_FOUND' : 'HTTP_ERROR',
      message: err.message || 'An error occurred',
      requestId,
      timestamp
    };

    return c.json(standardError, err.status);
  }

  // Generic error handler
  const standardError: StandardError = {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    requestId,
    timestamp
  };

  return c.json(standardError, 500);
};

// Updated createError function with code parameter
export const createError = (message: string, statusCode = 500, code?: string, details?: any) => {
  throw new AppError(message, statusCode, code, details);
};

// Common error types for consistency
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED', 
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;