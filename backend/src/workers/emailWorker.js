import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { QUEUE_NAMES } from '../lib/queues.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { emailService } from '../services/emailService.js';
import { storageService } from '../services/storageService.js';
import { qrService } from '../services/qrService.js';
import { usageService } from '../services/usageService.js';
import { getPlan } from '../config/plans.js';
import { logger } from '../lib/logger.js';

async function processEmail(job) {
  const { certificateId, orgId } = job.data;

  const tier = await usageService.getPlanTier(orgId);
  if (!getPlan(tier).features.email) {
    // Plan doesn't include email delivery — mark and skip (not an error).
    await supabaseAdmin.from('certificates').update({ email_status: 'not_sent' }).eq('id', certificateId);
    return { skipped: 'plan' };
  }

  const { data: cert } = await supabaseAdmin.from('certificates').select('*').eq('id', certificateId).single();
  if (!cert || !cert.recipient_email) return { skipped: 'no_recipient' };

  // Idempotency: if a previous attempt already delivered this email, don't send
  // again on a BullMQ retry (retries re-run the whole handler).
  if (cert.email_status === 'sent') return { skipped: 'already_sent' };

  const { data: org } = await supabaseAdmin.from('organizations').select('*').eq('id', orgId).single();
  if (!org) {
    // Org deleted between issuance and delivery — nothing we can do; don't retry.
    logger.warn({ certificateId, orgId }, 'email skipped: org not found');
    await supabaseAdmin.from('certificates').update({ email_status: 'failed' }).eq('id', certificateId);
    return { skipped: 'no_org' };
  }

  await supabaseAdmin.from('certificates').update({ email_status: 'queued' }).eq('id', certificateId);

  try {
    const downloadUrl = cert.pdf_url ? await storageService.signedUrl(cert.pdf_url, 7 * 24 * 3600) : '#';
    const result = await emailService.sendCertificate({
      to: cert.recipient_email,
      recipientName: cert.recipient_name,
      eventName: cert.fields?.event_name || 'your program',
      orgName: org.white_label && org.brand_name ? org.brand_name : org.name,
      brandColor: org.brand_color,
      verifyUrl: qrService.verificationUrl(cert.verification_code),
      downloadUrl,
      footer: org.footer_text,
    });

    // Resend not configured (dev / misconfigured prod): nothing actually left
    // the server, so don't claim 'sent' or consume email quota.
    if (result?.skipped) {
      await supabaseAdmin.from('certificates').update({ email_status: 'not_sent' }).eq('id', certificateId);
      return { skipped: 'not_configured' };
    }

    await supabaseAdmin.from('certificates').update({ email_status: 'sent' }).eq('id', certificateId);
    await usageService.incrementEmails(orgId, 1);
    return { sent: true };
  } catch (err) {
    await supabaseAdmin.from('certificates').update({ email_status: 'failed' }).eq('id', certificateId);
    logger.error({ err, certificateId }, 'certificate email failed');
    throw err; // let BullMQ retry per backoff policy
  }
}

export function startEmailWorker() {
  const worker = new Worker(QUEUE_NAMES.email, processEmail, {
    connection: createRedisConnection(),
    concurrency: Number(process.env.EMAIL_CONCURRENCY || 3),
    limiter: { max: 10, duration: 1000 }, // respect provider rate limits
  });
  worker.on('failed', (job, err) => logger.warn({ jobId: job?.id, err }, 'email job failed'));
  return worker;
}
