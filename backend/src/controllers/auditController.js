import { ok } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditService } from '../services/auditService.js';

export const auditController = {
  list: asyncHandler(async (req, res) => {
    const logs = await auditService.list(req.org.id, {
      limit: Math.min(200, parseInt(req.query.limit, 10) || 50),
      action: req.query.action,
    });
    return ok(res, logs);
  }),
};
