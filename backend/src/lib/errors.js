// Standard application error with a stable machine code + safe message.
export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const Errors = {
  unauthorized: (msg = 'Authentication required.') => new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'You do not have permission to perform this action.') =>
    new AppError(403, 'FORBIDDEN', msg),
  notFound: (msg = 'Resource not found.') => new AppError(404, 'NOT_FOUND', msg),
  badRequest: (msg = 'Invalid request.') => new AppError(400, 'BAD_REQUEST', msg),
  conflict: (msg = 'Resource already exists.') => new AppError(409, 'CONFLICT', msg),
  quotaExceeded: (msg = 'Plan limit reached. Upgrade to continue.') =>
    new AppError(402, 'QUOTA_EXCEEDED', msg),
  rateLimited: (msg = 'Too many requests. Please slow down.') =>
    new AppError(429, 'RATE_LIMITED', msg),
  invalidApiKey: (msg = 'The provided API key is invalid.') =>
    new AppError(401, 'INVALID_API_KEY', msg),
  internal: (msg = 'Something went wrong.') => new AppError(500, 'INTERNAL', msg),
};
