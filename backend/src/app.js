import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { authLimiter } from './middleware/rateLimit.js';

import apiRoutes from './routes/index.js';
import publicRoutes from './routes/public.js';
import apiV1Routes from './routes/apiV1.js';
import { billingController } from './controllers/billingController.js';
import { supabaseAdmin } from './lib/supabase.js';
import { redisConnection } from './lib/redis.js';

export function createApp() {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: false }));

  const corsOrigin = env.isProd
    ? env.frontendUrl
    : (origin, callback) => {
        if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
          callback(null, true);
        } else {
          callback(null, origin === env.frontendUrl);
        }
      };
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(pinoHttp({ logger }));

  // ── Health checks (used by Render) ───────────────────────────────────────
  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
  app.get('/health/db', async (_req, res) => {
    const { error } = await supabaseAdmin.from('organizations').select('id', { head: true, count: 'exact' }).limit(1);
    res.status(error ? 503 : 200).json({ status: error ? 'down' : 'ok' });
  });
  app.get('/health/redis', async (_req, res) => {
    try { await redisConnection.ping(); res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'down' }); }
  });

  // ── Razorpay webhook — MUST use raw body for signature verification ───────
  // Mounted before express.json so we can capture the exact bytes.
  app.post(
    '/webhooks/razorpay',
    express.raw({ type: 'application/json' }),
    (req, _res, next) => { req.rawBody = req.body; req.body = JSON.parse(req.body.toString('utf8') || '{}'); next(); },
    billingController.webhook,
  );

  // JSON body for everything else. 8mb accommodates base64 CSV uploads.
  app.use(express.json({ limit: '8mb' }));

  // Auth rate limiter applies to Supabase-auth-adjacent endpoints handled here.
  app.use('/api/auth', authLimiter);

  // ── Routers ──────────────────────────────────────────────────────────────
  app.use('/public', publicRoutes);
  app.use('/api/v1', apiV1Routes);   // developer API (API-key auth)
  app.use('/api', apiRoutes);        // dashboard API (user auth)

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
