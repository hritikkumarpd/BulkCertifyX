import { Worker } from 'bullmq';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { redisConnection } from '../lib/redis.js';
import { QUEUE_NAMES } from '../lib/queues.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { storageService } from '../services/storageService.js';
import { logger } from '../lib/logger.js';

/**
 * Packages a bulk job's successful certificate PDFs into a ZIP and uploads it.
 * Streams entries through archiver into a buffered PassThrough rather than
 * loading every PDF into memory at once, and downloads PDFs sequentially to
 * bound memory for large jobs.
 */
async function processZip(job) {
  const { jobId, orgId } = job.data;

  const { data: rows } = await supabaseAdmin
    .from('bulk_job_rows')
    .select('certificate_id')
    .eq('job_id', jobId)
    .eq('status', 'success')
    .not('certificate_id', 'is', null);

  if (!rows?.length) return { skipped: 'no_certs' };

  const archive = archiver('zip', { zlib: { level: 6 } });
  const pass = new PassThrough();
  const chunks = [];
  pass.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    pass.on('end', resolve);
    pass.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(pass);

  for (const { certificate_id } of rows) {
    const { data: cert } = await supabaseAdmin
      .from('certificates').select('verification_code, pdf_url, recipient_name').eq('id', certificate_id).single();
    if (!cert?.pdf_url) continue;
    try {
      const buf = await storageService.download(cert.pdf_url);
      const safeName = cert.recipient_name.replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
      archive.append(buf, { name: `${safeName}-${cert.verification_code}.pdf` });
    } catch (err) {
      logger.warn({ err, certificate_id }, 'skipping cert in zip');
    }
  }

  await archive.finalize();
  await done;

  const zipBuffer = Buffer.concat(chunks);
  const path = storageService.path(orgId, 'bulk', `${jobId}.zip`);
  await storageService.upload(path, zipBuffer, 'application/zip');
  await supabaseAdmin.from('bulk_jobs').update({ zip_url: path }).eq('id', jobId);

  return { entries: rows.length, path };
}

export function startZipWorker() {
  const worker = new Worker(QUEUE_NAMES.zip, processZip, {
    connection: redisConnection,
    concurrency: 1,
  });
  worker.on('failed', (job, err) => logger.warn({ jobId: job?.id, err }, 'zip job failed'));
  return worker;
}
