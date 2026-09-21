import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ok, created, paginated } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { certificateService } from '../services/certificateService.js';
import { usageService } from '../services/usageService.js';
import { storageService } from '../services/storageService.js';
import { emailQueue } from '../lib/queues.js';

const issueSchema = z.object({
  template_id: z.string().uuid(),
  event_id: z.string().uuid().nullish(),
  recipient_name: z.string().min(1).max(200),
  recipient_email: z.string().email().nullish(),
  fields: z.record(z.string()).optional(),
  expires_at: z.string().nullish(),
});

export const certificateController = {
  list: asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const from = (page - 1) * pageSize;

    let q = supabaseAdmin
      .from('certificates')
      .select('id, verification_code, recipient_name, recipient_email, status, issued_at, expires_at, verification_count, event_id, email_status', { count: 'exact' })
      .eq('org_id', req.org.id);

    if (req.query.search) {
      const s = req.query.search;
      q = q.or(`recipient_name.ilike.%${s}%,verification_code.ilike.%${s}%,recipient_email.ilike.%${s}%`);
    }
    if (req.query.event_id) q = q.eq('event_id', req.query.event_id);
    if (req.query.status === 'revoked') q = q.eq('status', 'revoked');

    const { data, count } = await q.order('issued_at', { ascending: false }).range(from, from + pageSize - 1);

    const items = (data || []).map((c) => ({ ...c, effective_status: certificateService.deriveStatus(c) }));
    return paginated(res, items, { page, pageSize, total: count || 0 });
  }),

  get: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('certificates').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!data) throw Errors.notFound('Certificate not found.');
    return ok(res, { ...data, effective_status: certificateService.deriveStatus(data) });
  }),

  // Single certificate generation from the dashboard.
  issue: asyncHandler(async (req, res) => {
    const body = issueSchema.parse(req.body);
    const cert = await certificateService.issueSingle({
      orgId: req.org.id,
      eventId: body.event_id || null,
      templateId: body.template_id,
      recipient: { recipient_name: body.recipient_name, recipient_email: body.recipient_email || null, ...(body.fields || {}) },
      expiresAt: body.expires_at || null,
      createdBy: req.user.id,
      host: req.headers['x-public-host'],
      usageService,
    });

    // Queue delivery email if there's an address (worker enforces plan gating).
    if (cert.recipient_email) {
      await emailQueue.add('certificate', { certificateId: cert.id, orgId: req.org.id }, { jobId: `email-${cert.id}` }).catch(() => {});
    }
    return created(res, cert);
  }),

  download: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('certificates').select('pdf_url').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!data?.pdf_url) throw Errors.notFound('Certificate PDF not found.');
    const url = await storageService.signedUrl(data.pdf_url, 300);
    return ok(res, { url });
  }),

  revoke: asyncHandler(async (req, res) => {
    const reason = z.object({ reason: z.string().max(300).optional() }).parse(req.body).reason;
    const cert = await certificateService.revoke({ orgId: req.org.id, certificateId: req.params.id, reason, userId: req.user.id });
    return ok(res, cert);
  }),

  resendEmail: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('certificates').select('id, recipient_email').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!data) throw Errors.notFound('Certificate not found.');
    if (!data.recipient_email) throw Errors.badRequest('This certificate has no recipient email.');
    await emailQueue.add('certificate', { certificateId: data.id, orgId: req.org.id }, { jobId: `email-${data.id}-${Date.now()}` });
    return ok(res, { queued: true });
  }),
};
