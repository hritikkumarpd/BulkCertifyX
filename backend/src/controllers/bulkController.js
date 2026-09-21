import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ok, created } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { csvService } from '../services/csvService.js';
import { bulkService } from '../services/bulkService.js';
import { storageService } from '../services/storageService.js';

export const bulkController = {
  // Step 1-2: parse an uploaded CSV (raw text in body) and suggest a mapping.
  parse: asyncHandler(async (req, res) => {
    const schema = z.object({ csv: z.string().min(1), size: z.number().optional() });
    const { csv, size } = schema.parse(req.body);
    const buffer = Buffer.from(csv, 'utf8');
    const { headers, rows } = csvService.parse({ buffer, size: size ?? buffer.length });
    const suggestedMap = csvService.autoMap(headers);
    return ok(res, {
      headers,
      rowCount: rows.length,
      preview: rows.slice(0, 20),
      suggestedMap,
    });
  }),

  // Step 3: validate rows against a column map (preview errors before generating).
  validate: asyncHandler(async (req, res) => {
    const schema = z.object({
      csv: z.string().min(1),
      columnMap: z.record(z.string()),
    });
    const { csv, columnMap } = schema.parse(req.body);
    const { rows } = csvService.parse({ buffer: Buffer.from(csv, 'utf8'), size: csv.length });
    const result = csvService.validate({ rows, columnMap });
    return ok(res, {
      validCount: result.validCount,
      errorCount: result.errorCount,
      preview: result.mapped.slice(0, 20),
    });
  }),

  // Step 4: create the job (reserves quota + enqueues).
  generate: asyncHandler(async (req, res) => {
    const schema = z.object({
      csv: z.string().min(1),
      columnMap: z.record(z.string()),
      template_id: z.string().uuid(),
      event_id: z.string().uuid().nullish(),
    });
    const { csv, columnMap, template_id, event_id } = schema.parse(req.body);

    const { rows } = csvService.parse({ buffer: Buffer.from(csv, 'utf8'), size: csv.length });
    const { mapped } = csvService.validate({ rows, columnMap });
    const validRows = mapped.filter((m) => m.valid);
    if (!validRows.length) throw Errors.badRequest('No valid rows to generate certificates from.');

    const job = await bulkService.createJob({
      orgId: req.org.id,
      eventId: event_id || null,
      templateId: template_id,
      columnMap,
      validRows,
      createdBy: req.user.id,
      host: req.headers['x-public-host'],
    });
    return created(res, job);
  }),

  list: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('bulk_jobs').select('*').eq('org_id', req.org.id).order('created_at', { ascending: false }).limit(50);
    return ok(res, data || []);
  }),

  get: asyncHandler(async (req, res) => {
    const job = await bulkService.getJob({ orgId: req.org.id, jobId: req.params.id });
    return ok(res, job);
  }),

  errors: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('bulk_job_rows').select('row_index, data, error')
      .eq('job_id', req.params.id).eq('org_id', req.org.id).eq('status', 'failed').order('row_index');
    return ok(res, data || []);
  }),

  retry: asyncHandler(async (req, res) => {
    const result = await bulkService.retryFailed({ orgId: req.org.id, jobId: req.params.id, host: req.headers['x-public-host'], userId: req.user.id });
    return ok(res, result);
  }),

  downloadZip: asyncHandler(async (req, res) => {
    const job = await bulkService.getJob({ orgId: req.org.id, jobId: req.params.id });
    if (!job.zip_url) throw Errors.badRequest('ZIP is not ready yet.');
    const url = await storageService.signedUrl(job.zip_url, 300);
    return ok(res, { url });
  }),
};
