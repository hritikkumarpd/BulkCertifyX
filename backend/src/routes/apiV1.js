import { Router } from 'express';
import { requireApiKey, requireScope } from '../middleware/apiKeyAuth.js';
import { apiLimiter } from '../middleware/rateLimit.js';
import { publicApiController } from '../controllers/publicApiController.js';

// Public developer API. Authenticated via API key, rate-limited per surface.
const router = Router();

router.use(apiLimiter);
router.use(requireApiKey);

router.post('/certificates', requireScope('certificates:write'), publicApiController.createCertificate);
router.get('/certificates/:id', requireScope('certificates:read'), publicApiController.getCertificate);
router.get('/verify/:code', requireScope('verify:read'), publicApiController.verify);
router.get('/events', requireScope('events:read'), publicApiController.listEvents);

export default router;
