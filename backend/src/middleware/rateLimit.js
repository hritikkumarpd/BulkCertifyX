import rateLimit from 'express-rate-limit';

// Distinct limiters per surface — the spec explicitly forbids one blanket limit.
const make = (windowMs, max, code) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: { code, message: 'Too many requests. Please slow down.' },
      }),
  });

export const authLimiter = make(15 * 60 * 1000, 20, 'RATE_LIMITED');          // login/register
export const verifyLimiter = make(60 * 1000, 60, 'RATE_LIMITED');             // public verification
export const apiLimiter = make(60 * 1000, 120, 'RATE_LIMITED');               // authenticated public API
export const bulkLimiter = make(60 * 1000, 10, 'RATE_LIMITED');               // bulk job creation
export const billingLimiter = make(60 * 1000, 30, 'RATE_LIMITED');            // billing operations
export const certIssueLimiter = make(60 * 1000, 20, 'RATE_LIMITED');           // single cert generation
export const generalLimiter = make(60 * 1000, 300, 'RATE_LIMITED');           // default dashboard API
