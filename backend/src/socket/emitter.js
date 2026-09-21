import IORedis from 'ioredis';
import { env } from '../config/env.js';

/**
 * Workers run in a separate process from the API (which holds the Socket.io
 * server), so progress events are published over a Redis pub/sub channel. The
 * API subscribes and relays to the right org room. This keeps workers
 * independently deployable.
 */
const CHANNEL = 'bcx:progress';
const pub = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

export function publishProgress(orgId, event, payload) {
  return pub.publish(CHANNEL, JSON.stringify({ orgId, event, payload }));
}

export function subscribeProgress(onMessage) {
  const sub = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  sub.subscribe(CHANNEL);
  sub.on('message', (_ch, raw) => {
    try { onMessage(JSON.parse(raw)); } catch { /* ignore malformed */ }
  });
  return sub;
}

export { CHANNEL };
