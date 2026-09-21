import { supabaseAdmin } from '../lib/supabase.js';
import { ok } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { usageService } from '../services/usageService.js';

// Group timestamps into daily buckets for the last N days.
function bucketByDay(rows, field, days = 30) {
  const map = {};
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    map[d.toISOString().slice(0, 10)] = 0;
  }
  for (const r of rows) {
    const key = String(r[field]).slice(0, 10);
    if (key in map) map[key] += 1;
  }
  return Object.entries(map).map(([date, count]) => ({ date, count }));
}

export const analyticsController = {
  overview: asyncHandler(async (req, res) => {
    const orgId = req.org.id;
    const [{ count: issued }, { count: revoked }, { count: verifCount }, snapshot] = await Promise.all([
      supabaseAdmin.from('certificates').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabaseAdmin.from('certificates').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'revoked'),
      supabaseAdmin.from('verification_logs').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      usageService.getSnapshot(orgId),
    ]);

    return ok(res, {
      certificatesIssued: issued || 0,
      certificatesRevoked: revoked || 0,
      verifications: verifCount || 0,
      verificationRate: issued ? Math.round(((verifCount || 0) / issued) * 100) : 0,
      emailsSent: snapshot.emails,
      usage: snapshot,
    });
  }),

  trends: asyncHandler(async (req, res) => {
    const orgId = req.org.id;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [{ data: certs }, { data: verifs }] = await Promise.all([
      supabaseAdmin.from('certificates').select('issued_at').eq('org_id', orgId).gte('issued_at', since),
      supabaseAdmin.from('verification_logs').select('verified_at').eq('org_id', orgId).gte('verified_at', since),
    ]);
    return ok(res, {
      certificates: bucketByDay(certs || [], 'issued_at'),
      verifications: bucketByDay(verifs || [], 'verified_at'),
    });
  }),

  events: asyncHandler(async (req, res) => {
    const { data: events } = await supabaseAdmin.from('events').select('id, name').eq('org_id', req.org.id);
    const stats = await Promise.all(
      (events || []).map(async (e) => {
        const [{ count: certs }, { count: verifs }] = await Promise.all([
          supabaseAdmin.from('certificates').select('id', { count: 'exact', head: true }).eq('event_id', e.id),
          supabaseAdmin.from('verification_logs').select('id', { count: 'exact', head: true }).in('certificate_id',
            (await supabaseAdmin.from('certificates').select('id').eq('event_id', e.id)).data?.map((c) => c.id) || ['00000000-0000-0000-0000-000000000000']),
        ]);
        return { id: e.id, name: e.name, certificates: certs || 0, verifications: verifs || 0, verificationRate: certs ? Math.round(((verifs || 0) / certs) * 100) : 0 };
      }),
    );
    return ok(res, stats);
  }),
};
