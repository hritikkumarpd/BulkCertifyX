import { ok } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verificationService } from '../services/verificationService.js';

export const verificationController = {
  // Public — no auth. Rate-limited upstream. Returns a minimal, safe payload.
  verify: asyncHandler(async (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const result = await verificationService.verify(code, {
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer,
    });
    // Always 200 with a `result` discriminator — never leak existence via status codes
    // beyond the intended not_found signal.
    return ok(res, result);
  }),
};
