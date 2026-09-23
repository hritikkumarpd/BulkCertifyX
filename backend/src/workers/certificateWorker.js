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

  // A prior attempt of this job may have died mid-row, leaving rows stuck in
  // 'processing'. Reclaim them as pending so this attempt can finish them.
  await supabaseAdmin.from('bulk_job_rows')
    .update({ status: 'pending' }).eq('job_id', jobId).eq('status', 'processing').is('certificate_id', null);

  const { data: rows } = await supabaseAdmin
    .from('bulk_job_rows').select('*').eq('job_id', jobId).eq('status', 'pending').order('row_index');

  // Seed counters from the AUTHORITATIVE current row states, not from the stored
  // job row (which, on a retry, already reflects the previous run and would push
  // progress past 100% and misclassify an all-failed retry as "completed").
  const [{ count: successSoFar }, { count: failedSoFar }] = await Promise.all([
    supabaseAdmin.from('bulk_job_rows').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'success'),
    supabaseAdmin.from('bulk_job_rows').select('id', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'failed'),
  ]);
  let successful = successSoFar || 0;
  let failed = failedSoFar || 0;
  let processed = successful + failed;
  let failedThisRun = 0;
  const total = bulkJob.total_rows;

  for (const row of rows || []) {
    // Idempotency: if this row was already issued (crash between issue and the
    // status write), don't create a second certificate — just reconcile status.
    if (row.certificate_id) {
      await supabaseAdmin.from('bulk_job_rows').update({ status: 'success', error: null }).eq('id', row.id);
      successful += 1; processed += 1;
      continue;
    }

    // Claim the row so a concurrent/retried run won't pick it up and duplicate.
    const { data: claimed } = await supabaseAdmin.from('bulk_job_rows')
      .update({ status: 'processing' }).eq('id', row.id).eq('status', 'pending').select('id').maybeSingle();
    if (!claimed) continue; // another attempt already took it

    try {
      const cert = await certificateService.issueOne({
        org, event, template, row: row.data, createdBy: bulkJob.created_by, host,
      });
      const { error: upErr } = await supabaseAdmin.from('bulk_job_rows')
        .update({ status: 'success', certificate_id: cert.id, error: null }).eq('id', row.id);
      if (upErr) logger.error({ upErr, rowId: row.id, certId: cert.id }, 'row issued but status update failed');
      successful += 1;

      // Queue delivery email if there's an address.
      if (cert.recipient_email) {
        await emailQueue.add('certificate', { certificateId: cert.id, orgId }, { jobId: `email-${cert.id}` }).catch(() => {});
      }
    } catch (err) {
      failed += 1;
      failedThisRun += 1;
      await supabaseAdmin.from('bulk_job_rows')
        .update({ status: 'failed', error: String(err.message || err).slice(0, 500) }).eq('id', row.id);
      logger.warn({ err, rowId: row.id }, 'bulk row failed');
    }
    processed += 1;

    await supabaseAdmin.from('bulk_jobs').update({ processed, successful, failed }).eq('id', jobId);
    publishProgress(orgId, 'bulk:progress', {
      jobId, total, processed, successful, failed,
      percent: total ? Math.min(100, Math.round((processed / total) * 100)) : 100,
    });
  }

  // Reconcile quota: release slots reserved for rows that failed IN THIS RUN
  // (rows that failed in a previous run had their quota released then, and
  // retryFailed re-reserves for its own batch).
  if (failedThisRun > 0) {
    await usageService.releaseCertificates(orgId, failedThisRun, reservedPeriod).catch(() => {});
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
