import { Queue } from 'bullmq';
import { redisConnection } from './redis.js';

export const QUEUE_NAMES = {
  certificate: 'certificate-generation',
  email: 'email-delivery',
  zip: 'zip-generation',
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 }, // keep failures a week for inspection
};

export const certificateQueue = new Queue(QUEUE_NAMES.certificate, {
  connection: redisConnection,
  defaultJobOptions,
});

export const emailQueue = new Queue(QUEUE_NAMES.email, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 5 },
});

export const zipQueue = new Queue(QUEUE_NAMES.zip, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
});

const handleQueueError = (err) => {
  if (err?.code !== 'ECONNREFUSED') {
    console.error('[queue error]:', err?.message || err);
  }
};

certificateQueue.on('error', handleQueueError);
emailQueue.on('error', handleQueueError);
zipQueue.on('error', handleQueueError);

