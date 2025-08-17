import { Context } from 'hono';

export interface APIError {
  error: string;
  message: string;
  details?: any;
  statusCode?: number;
}

export class AppError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode = 500, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const errorHandler = (err: Error, c: Context) => {
  console.error('API Error:', err);

  if (err instanceof AppError) {
    return c.json({
      error: err.name,
      message: err.message,
      details: err.details
    }, err.statusCode);
  }

  // Handle Hono HTTP errors
  if ('status' in err && typeof err.status === 'number') {
    return c.json({
      error: 'HTTP_ERROR',
      message: err.message || 'An error occurred'
    }, err.status);
  }

  // Generic error handler
  return c.json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred'
  }, 500);
};

export const createError = (message: string, statusCode = 500, details?: any) => {
  throw new AppError(message, statusCode, details);
};