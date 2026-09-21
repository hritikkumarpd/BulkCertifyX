import { startCertificateWorker } from './certificateWorker.js';
import { startEmailWorker } from './emailWorker.js';
import { startZipWorker } from './zipWorker.js';
import { pdfService } from '../services/pdfService.js';
import { redisConnection } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

logger.info('Starting BulkCertifyX workers...');

const workers = [startCertificateWorker(), startEmailWorker(), startZipWorker()];

logger.info('Workers running: certificate-generation, email-delivery, zip-generation');

// Graceful shutdown — drain workers, close Puppeteer + Redis.
async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down workers...');
  try {
    await Promise.all(workers.map((w) => w.close()));
    await pdfService.close();
    await redisConnection.quit();
  } catch (err) {
    logger.error({ err }, 'Error during worker shutdown');
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
