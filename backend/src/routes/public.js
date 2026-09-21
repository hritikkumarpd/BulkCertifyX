import { Router } from 'express';
import { verifyLimiter } from '../middleware/rateLimit.js';
import { verificationController } from '../controllers/verificationController.js';
import { billingController } from '../controllers/billingController.js';

// Unauthenticated public routes.
const router = Router();

// Public certificate verification.
router.get('/verify/:code', verifyLimiter, verificationController.verify);

// Public plan catalog (pricing page).
router.get('/plans', billingController.plans);

export default router;
