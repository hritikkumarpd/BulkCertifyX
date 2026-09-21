import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { ZodError } from 'zod';

// 404 for unmatched routes.
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested endpoint does not exist.' },
  });
}

// Centralized error handler — never leaks stack traces to clients.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request failed validation.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error({ err }, err.message);
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // Unknown error: log full detail server-side, return safe generic message.
  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: 'Something went wrong.' },
  });
}

// Wrap async route handlers so thrown errors reach the error handler.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
