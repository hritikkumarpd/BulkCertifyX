import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { certificateService } from '../services/certificateService.js';
import { verificationService } from '../services/verificationService.js';
import { usageService } from '../services/usageService.js';
import { emailQueue } from '../lib/queues.js';

// Public API uses the standard { success, data } / { success, error } envelope.
const apiOk = (res, data, status = 200) => res.status(status).json({ success: true, data });

export const publicApiController = {
  // POST /api/v1/certificates
  createCertificate: asyncHandler(async (req, res) => {
    const body = z.object({
      template_id: z.string().uuid(),
      event_id: z.string().uuid().nullish(),
      recipient_name: z.string().min(1).max(200),
      recipient_email: z.string().email().nullish(),
      fields: z.record(z.string()).optional(),
      expires_at: z.string().nullish(),
      send_email: z.boolean().optional(),
    }).parse(req.body);

    const cert = await certificateService.issueSingle({
      orgId: req.apiOrgId,
      eventId: body.event_id || null,
      templateId: body.template_id,
      recipient: { recipient_name: body.recipient_name, recipient_email: body.recipient_email || null, ...(body.fields || {}) },
      expiresAt: body.expires_at || null,
      createdBy: null,
      usageService,
    });

    if (body.send_email && cert.recipient_email) {
      await emailQueue.add('certificate', { certificateId: cert.id, orgId: req.apiOrgId }, { jobId: `email-${cert.id}` }).catch(() => {});
    }
    return apiOk(res, {
      id: cert.id,
      verification_code: cert.verification_code,
      recipient_name: cert.recipient_name,
      status: cert.status,
      issued_at: cert.issued_at,
    }, 201);
  }),

  // GET /api/v1/certificates/:id
  getCertificate: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('certificates')
      .select('id, verification_code, recipient_name, recipient_email, status, issued_at, expires_at, fields, verification_count')
      .eq('id', req.params.id).eq('org_id', req.apiOrgId).maybeSingle();
    if (!data) throw Errors.notFound('Certificate not found.');
    return apiOk(res, { ...data, effective_status: certificateService.deriveStatus(data) });
  }),

  // GET /api/v1/verify/:code  (scoped to the key's org for API use)
  verify: asyncHandler(async (req, res) => {
    const result = await verificationService.verify(String(req.params.code).toUpperCase());
    return apiOk(res, result);
  }),

  // GET /api/v1/events
  listEvents: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('events').select('id, name, event_date, status').eq('org_id', req.apiOrgId).order('created_at', { ascending: false });
    return apiOk(res, data || []);
  }),
};
