import { Worker } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { QUEUE_NAMES, emailQueue, zipQueue } from '../lib/queues.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { certificateService } from '../services/certificateService.js';
import { usageService } from '../services/usageService.js';
import { auditService } from '../services/auditService.js';
import { publishProgress } from '../socket/emitter.js';
import { logger } from '../lib/logger.js';

/**
 * Processes a bulk job: renders each pending row into a certificate, updates
 * progress, and reconciles quota for permanently failed rows. Emits progress
 * over Redis pub/sub so the API can relay to the browser via Socket.io.
 */
async function processBulkJob(job) {
  const { jobId, orgId, host, reservedPeriod } = job.data;

  const { data: bulkJob } = await supabaseAdmin.from('bulk_jobs').select('*').eq('id', jobId).single();
  if (!bulkJob) throw new Error(`Bulk job ${jobId} not found`);

  await supabaseAdmin.from('bulk_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', jobId);

  const [{ data: org }, { data: event }, { data: template }] = await Promise.all([
    supabaseAdmin.from('organizations').select('*').eq('id', orgId).single(),
    bulkJob.event_id ? supabaseAdmin.from('events').select('*').eq('id', bulkJob.event_id).maybeSingle() : Promise.resolve({ data: null }),
    supabaseAdmin.from('templates').select('*').eq('id', bulkJob.template_id).maybeSingle(),
  ]);
  if (!template) throw new Error('Template missing for bulk job');

  const { data: rows } = await supabaseAdmin
    .from('bulk_job_rows').select('*').eq('job_id', jobId).eq('status', 'pending').order('row_index');

  let successful = bulkJob.successful || 0;
  let failed = 0;
  let processed = bulkJob.processed || 0;
  const total = bulkJob.total_rows;

  for (const row of rows || []) {
    try {
      const cert = await certificateService.issueOne({
        org, event, template, row: row.data, createdBy: bulkJob.created_by, host,
      });
      await supabaseAdmin.from('bulk_job_rows')
        .update({ status: 'success', certificate_id: cert.id, error: null }).eq('id', row.id);
      successful += 1;

      // Queue delivery email if the org's plan allows it and there's an address.
      if (cert.recipient_email) {
        await emailQueue.add('certificate', { certificateId: cert.id, orgId }, { jobId: `email-${cert.id}` }).catch(() => {});
      }
    } catch (err) {
      failed += 1;
      await supabaseAdmin.from('bulk_job_rows')
        .update({ status: 'failed', error: String(err.message || err).slice(0, 500) }).eq('id', row.id);
      logger.warn({ err, rowId: row.id }, 'bulk row failed');
    }
    processed += 1;

    await supabaseAdmin.from('bulk_jobs').update({ processed, successful, failed }).eq('id', jobId);
    publishProgress(orgId, 'bulk:progress', {
      jobId, total, processed, successful, failed,
      percent: total ? Math.round((processed / total) * 100) : 100,
    });
  }

  // Reconcile quota: release slots reserved for rows that permanently failed.
  if (failed > 0) {
    await usageService.releaseCertificates(orgId, failed, reservedPeriod).catch(() => {});
  }

  const finalStatus = failed === 0 ? 'completed' : successful === 0 ? 'failed' : 'completed_with_errors';
  await supabaseAdmin.from('bulk_jobs')
    .update({ status: finalStatus, completed_at: new Date().toISOString() }).eq('id', jobId);

  publishProgress(orgId, 'bulk:complete', { jobId, status: finalStatus, total, successful, failed });

  await supabaseAdmin.from('notifications').insert({
    org_id: orgId,
    type: finalStatus === 'failed' ? 'bulk_failed' : 'bulk_completed',
    title: finalStatus === 'failed' ? 'Bulk generation failed' : 'Bulk generation completed',
    body: `${successful} of ${total} certificates generated${failed ? `, ${failed} failed` : ''}.`,
    link: `/bulk/${jobId}`,
  });
  await auditService.log({ orgId, userId: bulkJob.created_by, action: 'bulk.completed', resourceType: 'bulk_job', resourceId: jobId, metadata: { successful, failed } });

  // Kick off async ZIP packaging for successful certificates.
  if (successful > 0) {
    await zipQueue.add('zip', { jobId, orgId }, { jobId: `zip-${jobId}` }).catch(() => {});
  }

  return { successful, failed };
}

export function startCertificateWorker() {
  const worker = new Worker(QUEUE_NAMES.certificate, processBulkJob, {
    connection: createRedisConnection(),
    concurrency: Number(process.env.BULK_CONCURRENCY || 2),
  });
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'certificate job failed'));
  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'certificate job completed'));
  return worker;
}
