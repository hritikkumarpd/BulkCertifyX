import http from 'node:http';
import { createApp } from './app.js';
import { attachSocket } from './socket/io.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { redisConnection } from './lib/redis.js';
import { startCertificateWorker } from './workers/certificateWorker.js';
import { startEmailWorker } from './workers/emailWorker.js';
import { startZipWorker } from './workers/zipWorker.js';
import { pdfService } from './services/pdfService.js';

const app = createApp();
const server = http.createServer(app);
attachSocket(server);

// In free-tier mode, run background workers in the same process as the API
let workers = [];
if (process.env.RUN_WORKERS_IN_API !== 'false') {
  try {
    logger.info('Starting embedded background workers (free tier mode)...');
    workers = [startCertificateWorker(), startEmailWorker(), startZipWorker()];
    logger.info('Workers active: certificate-generation, email-delivery, zip-generation');
  } catch (err) {
    logger.error({ err }, 'Failed to start background workers');
  }
}

server.listen(env.port, () => {
  logger.info(`BulkCertifyX API listening on :${env.port} (${env.nodeEnv})`);
});

// Graceful shutdown.
async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down API...');
  server.close(async () => {
    try {
      if (workers.length > 0) {
        await Promise.all(workers.map((w) => w.close()));
        await pdfService.close();
      }
      await redisConnection.quit();
    } catch { /* noop */ }
    process.exit(0);
  });
  // Force-exit if connections linger.
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

