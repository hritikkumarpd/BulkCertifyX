import { supabaseAdmin } from '../lib/supabase.js';
import { certificateQueue } from '../lib/queues.js';
import { usageService } from './usageService.js';
import { auditService } from './auditService.js';
import { Errors } from '../lib/errors.js';

export const bulkService = {
  /**
   * Create a bulk job from validated rows. Reserves quota ATOMICALLY for the
   * valid rows up front so concurrent jobs can't collectively overshoot, then
   * persists rows and enqueues one BullMQ job.
   */
  async createJob({ orgId, eventId, templateId, columnMap, validRows, createdBy, host }) {
    if (!validRows.length) throw Errors.badRequest('No valid rows to generate.');
    await usageService.assertBulkAllowed(orgId, validRows.length);

    // Reserve quota for exactly the valid rows. Throws QUOTA_EXCEEDED if no room.
    const period = await usageService.reserveCertificates(orgId, validRows.length);

    // Create the job record.
    const { data: job, error } = await supabaseAdmin
      .from('bulk_jobs')
      .insert({
        org_id: orgId,
        event_id: eventId || null,
        template_id: templateId,
        status: 'queued',
        total_rows: validRows.length,
        column_map: columnMap,
        created_by: createdBy || null,
      })
      .select()
      .single();
    if (error) {
      await usageService.releaseCertificates(orgId, validRows.length, period).catch(() => {});
      throw Errors.internal('Failed to create bulk job.');
    }

    // Persist rows (batched insert).
    const rowRecords = validRows.map((r, idx) => ({
      job_id: job.id,
      org_id: orgId,
      row_index: idx,
      data: r.data,
      status: 'pending',
    }));
    const { error: rowErr } = await supabaseAdmin.from('bulk_job_rows').insert(rowRecords);
    if (rowErr) {
      await supabaseAdmin.from('bulk_jobs').delete().eq('id', job.id);
      await usageService.releaseCertificates(orgId, validRows.length, period).catch(() => {});
      throw Errors.internal('Failed to persist bulk rows.');
    }

    // Enqueue. jobId = job.id makes enqueue idempotent (retried request won't double-run).
    await certificateQueue.add(
      'generate',
      { jobId: job.id, orgId, host, reservedPeriod: period },
      { jobId: `bulk-${job.id}` },
    );

    await auditService.log({ orgId, userId: createdBy, action: 'bulk.created', resourceType: 'bulk_job', resourceId: job.id, metadata: { rows: validRows.length } });
    return job;
  },

  /** Retry only the failed rows of a job (does not regenerate successes). */
  async retryFailed({ orgId, jobId, host, userId }) {
    const { data: job } = await supabaseAdmin
      .from('bulk_jobs').select('*').eq('id', jobId).eq('org_id', orgId).maybeSingle();
    if (!job) throw Errors.notFound('Bulk job not found.');

    const { data: failedRows } = await supabaseAdmin
      .from('bulk_job_rows').select('id').eq('job_id', jobId).eq('status', 'failed');
    if (!failedRows?.length) throw Errors.badRequest('No failed rows to retry.');

    // Reserve quota for the retry batch.
    const period = await usageService.reserveCertificates(orgId, failedRows.length);

    await supabaseAdmin.from('bulk_job_rows').update({ status: 'pending', error: null })
      .eq('job_id', jobId).eq('status', 'failed');
    await supabaseAdmin.from('bulk_jobs')
      .update({ status: 'queued', failed: 0 }).eq('id', jobId);

    await certificateQueue.add(
      'generate',
      { jobId, orgId, host, reservedPeriod: period, retry: true },
      { jobId: `bulk-${jobId}-retry-${Date.now()}` },
    );
    await auditService.log({ orgId, userId, action: 'bulk.retried', resourceType: 'bulk_job', resourceId: jobId, metadata: { rows: failedRows.length } });
    return { retried: failedRows.length };
  },

  async getJob({ orgId, jobId }) {
    const { data: job } = await supabaseAdmin
      .from('bulk_jobs').select('*').eq('id', jobId).eq('org_id', orgId).maybeSingle();
    if (!job) throw Errors.notFound('Bulk job not found.');
    return job;
  },
};
