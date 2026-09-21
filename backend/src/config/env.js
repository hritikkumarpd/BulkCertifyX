import dotenv from 'dotenv';
dotenv.config();

/** Read a required env var, throwing a clear error if missing in production. */
function required(key, fallback = undefined) {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    // In dev we warn but continue so the app can boot with .env.example placeholders.
    console.warn(`[env] ${key} is not set — using empty value (dev only)`);
    return '';
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 3000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  publicAppUrl: process.env.PUBLIC_APP_URL || 'http://localhost:5173',

  supabase: {
    url: required('SUPABASE_URL'),
    anonKey: required('SUPABASE_ANON_KEY'),
    serviceKey: required('SUPABASE_SERVICE_KEY'),
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'certificates',
    dbUrl: process.env.SUPABASE_DB_URL || '',
  },

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    plans: {
      starter: {
        monthly: process.env.RAZORPAY_PLAN_STARTER_MONTHLY || '',
        annual: process.env.RAZORPAY_PLAN_STARTER_ANNUAL || '',
      },
      pro: {
        monthly: process.env.RAZORPAY_PLAN_PRO_MONTHLY || '',
        annual: process.env.RAZORPAY_PLAN_PRO_ANNUAL || '',
      },
      enterprise: {
        monthly: process.env.RAZORPAY_PLAN_ENTERPRISE_MONTHLY || '',
        annual: process.env.RAZORPAY_PLAN_ENTERPRISE_ANNUAL || '',
      },
    },
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'BulkCertifyX <no-reply@bulkcertifyx.com>',
  },

  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret',
  sentryDsn: process.env.SENTRY_DSN || '',
  logLevel: process.env.LOG_LEVEL || 'info',
};
