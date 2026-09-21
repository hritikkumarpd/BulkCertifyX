import { Router } from 'express';
import { requireAuth, requireOrg, requireRole } from '../middleware/auth.js';
import { generalLimiter, bulkLimiter, billingLimiter } from '../middleware/rateLimit.js';

import { organizationController } from '../controllers/organizationController.js';
import { templateController } from '../controllers/templateController.js';
import { eventController } from '../controllers/eventController.js';
import { certificateController } from '../controllers/certificateController.js';
import { bulkController } from '../controllers/bulkController.js';
import { teamController } from '../controllers/teamController.js';
import { analyticsController } from '../controllers/analyticsController.js';
import { dashboardController } from '../controllers/dashboardController.js';
import { notificationController } from '../controllers/notificationController.js';
import { apiKeyController } from '../controllers/apiKeyController.js';
import { domainController } from '../controllers/domainController.js';
import { billingController } from '../controllers/billingController.js';
import { auditController } from '../controllers/auditController.js';

const router = Router();

// Everything here requires an authenticated user.
router.use(requireAuth);
router.use(generalLimiter);

// ── Organizations (org context resolved inside for list/create) ────────────
router.get('/organizations', organizationController.list);
router.post('/organizations', organizationController.create);

// Invitation acceptance only needs auth, not org membership.
router.post('/team/accept', teamController.accept);

// ── Everything below requires org context (x-org-id header) ────────────────
router.use(requireOrg);

router.get('/organization', organizationController.get);
router.patch('/organization', requireRole('owner', 'admin'), organizationController.update);

// Dashboard
router.get('/dashboard', dashboardController.home);
router.get('/dashboard/usage', dashboardController.usage);
router.get('/search', dashboardController.search);

// Templates
router.get('/templates', templateController.list);
router.post('/templates', templateController.create);
router.get('/templates/:id', templateController.get);
router.get('/templates/:id/preview', templateController.preview);
router.patch('/templates/:id', templateController.update);
router.post('/templates/:id/duplicate', templateController.duplicate);
router.delete('/templates/:id', templateController.remove);

// Events
router.get('/events', eventController.list);
router.post('/events', eventController.create);
router.get('/events/:id', eventController.get);
router.patch('/events/:id', eventController.update);
router.post('/events/:id/duplicate', eventController.duplicate);
router.post('/events/:id/archive', eventController.archive);

// Certificates
router.get('/certificates', certificateController.list);
router.post('/certificates', certificateController.issue);
router.get('/certificates/:id', certificateController.get);
router.get('/certificates/:id/download', certificateController.download);
router.post('/certificates/:id/revoke', certificateController.revoke);
router.post('/certificates/:id/resend', certificateController.resendEmail);

// Bulk
router.post('/bulk/parse', bulkController.parse);
router.post('/bulk/validate', bulkController.validate);
router.post('/bulk/generate', bulkLimiter, bulkController.generate);
router.get('/bulk', bulkController.list);
router.get('/bulk/:id', bulkController.get);
router.get('/bulk/:id/errors', bulkController.errors);
router.post('/bulk/:id/retry', bulkLimiter, bulkController.retry);
router.get('/bulk/:id/zip', bulkController.downloadZip);

// Analytics
router.get('/analytics/overview', analyticsController.overview);
router.get('/analytics/trends', analyticsController.trends);
router.get('/analytics/events', analyticsController.events);

// Team (management restricted to owner/admin)
router.get('/team', teamController.list);
router.post('/team/invite', requireRole('owner', 'admin'), teamController.invite);
router.post('/team/:id/resend', requireRole('owner', 'admin'), teamController.resend);
router.patch('/team/:id/role', requireRole('owner', 'admin'), teamController.changeRole);
router.delete('/team/:id', requireRole('owner', 'admin'), teamController.remove);

// API keys (owner/admin only)
router.get('/api-keys', requireRole('owner', 'admin'), apiKeyController.list);
router.post('/api-keys', requireRole('owner', 'admin'), apiKeyController.create);
router.delete('/api-keys/:id', requireRole('owner', 'admin'), apiKeyController.revoke);

// Custom domains (owner/admin only)
router.get('/domains', requireRole('owner', 'admin'), domainController.list);
router.post('/domains', requireRole('owner', 'admin'), domainController.add);
router.post('/domains/:id/verify', requireRole('owner', 'admin'), domainController.verify);
router.delete('/domains/:id', requireRole('owner', 'admin'), domainController.remove);

// Billing (owner only for mutations)
router.get('/billing', billingController.overview);
router.post('/billing/subscribe', billingLimiter, requireRole('owner'), billingController.subscribe);
router.post('/billing/cancel', billingLimiter, requireRole('owner'), billingController.cancel);

// Notifications
router.get('/notifications', notificationController.list);
router.post('/notifications/:id/read', notificationController.markRead);
router.post('/notifications/read-all', notificationController.markAllRead);

// Audit log (owner/admin)
router.get('/audit', requireRole('owner', 'admin'), auditController.list);

export default router;
