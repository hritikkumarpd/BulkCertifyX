import IORedis from 'ioredis';
import { env } from '../config/env.js';

// BullMQ requires maxRetriesPerRequest = null on the connection it uses.
export function createRedisConnection() {
  const conn = new IORedis(env.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (!env.isProd && times > 3) {
        return null; // Stop reconnect loop in dev when no local redis is running
      }
      return Math.min(times * 1000, 5000);
    },
  });

  conn.on('error', (err) => {
    if (err?.code !== 'ECONNREFUSED') {
      console.error('[redis] connection error:', err.message);
    }
  });

  return conn;
}

export const redisConnection = createRedisConnection();
