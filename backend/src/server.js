import http from 'node:http';
import { createApp } from './app.js';
import { attachSocket } from './socket/io.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { redisConnection } from './lib/redis.js';

const app = createApp();
const server = http.createServer(app);
attachSocket(server);

server.listen(env.port, () => {
  logger.info(`BulkCertifyX API listening on :${env.port} (${env.nodeEnv})`);
});

// Graceful shutdown.
async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down API...');
  server.close(async () => {
    try { await redisConnection.quit(); } catch { /* noop */ }
    process.exit(0);
  });
  // Force-exit if connections linger.
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
