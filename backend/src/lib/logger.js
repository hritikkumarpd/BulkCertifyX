import { createRequire } from 'module';
import pino from 'pino';
import { env } from '../config/env.js';

// Pretty logs in development, but only if pino-pretty is actually installed.
// Falls back to plain JSON logging so the server always boots.
const require = createRequire(import.meta.url);
let prettyTransport;
if (!env.isProd) {
  try {
    require.resolve('pino-pretty');
    prettyTransport = { target: 'pino-pretty', options: { colorize: true } };
  } catch {
    prettyTransport = undefined;
  }
}

// Redact anything that could leak secrets.
export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      '*.password',
      'key_secret',
      'service_key',
      'apiKey',
      'token',
      '*.token',
    ],
    censor: '[redacted]',
  },
  transport: prettyTransport,
});
