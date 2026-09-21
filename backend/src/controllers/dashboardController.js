import { supabaseAdmin } from '../lib/supabase.js';
import { ok } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { usageService } from '../services/usageService.js';

export const dashboardController = {
  home: asyncHandler(async (req, res) => {
    const orgId = req.org.id;
    const [snapshot, { data: recentBulk }, { data: recentCerts }] = await Promise.all([
      usageService.getSnapshot(orgId),
      supabaseAdmin.from('bulk_jobs')
        .select('id, status, total_rows, successful, failed, created_at, event_id, template_id')
        .eq('org_id', orgId).order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('certificates')
        .select('id, recipient_name, verification_code, status, issued_at, event_id')
        .eq('org_id', orgId).order('issued_at', { ascending: false }).limit(8),
    ]);
    return ok(res, {
      usage: snapshot,
      recentBulkJobs: recentBulk || [],
      recentCertificates: recentCerts || [],
    });
  }),

  usage: asyncHandler(async (req, res) => {
    return ok(res, await usageService.getSnapshot(req.org.id));
  }),

  // Global search across certificates, events, and templates.
  search: asyncHandler(async (req, res) => {
    const raw = String(req.query.q || '').trim();
    const q = raw.replace(/[,()%"'\\]/g, ' ').trim();
    if (q.length < 2) return ok(res, { certificates: [], events: [], templates: [] });
    const orgId = req.org.id;
    const [{ data: certs }, { data: events }, { data: templates }] = await Promise.all([
      supabaseAdmin.from('certificates').select('id, recipient_name, verification_code')
        .eq('org_id', orgId).or(`recipient_name.ilike.%${q}%,verification_code.ilike.%${q}%`).limit(5),
      supabaseAdmin.from('events').select('id, name').eq('org_id', orgId).ilike('name', `%${q}%`).limit(5),
      supabaseAdmin.from('templates').select('id, name').eq('org_id', orgId).ilike('name', `%${q}%`).limit(5),
    ]);
    return ok(res, { certificates: certs || [], events: events || [], templates: templates || [] });
  }),
};
