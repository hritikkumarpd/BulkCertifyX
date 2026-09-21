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
    const orgId = req.org.id;
    const { data: events } = await supabaseAdmin.from('events').select('id, name').eq('org_id', orgId);
    if (!events?.length) return ok(res, []);

    const eventIds = events.map((e) => e.id);
    const [{ data: certs }, { data: verifs }] = await Promise.all([
      supabaseAdmin.from('certificates').select('id, event_id').eq('org_id', orgId).in('event_id', eventIds),
      supabaseAdmin.from('verification_logs').select('certificate_id').eq('org_id', orgId),
    ]);

    const certToEvent = new Map();
    const certCounts = {};
    for (const c of certs || []) {
      if (c.event_id) {
        certToEvent.set(c.id, c.event_id);
        certCounts[c.event_id] = (certCounts[c.event_id] || 0) + 1;
      }
    }

    const verifCounts = {};
    for (const v of verifs || []) {
      const evId = certToEvent.get(v.certificate_id);
      if (evId) {
        verifCounts[evId] = (verifCounts[evId] || 0) + 1;
      }
    }

    const stats = events.map((e) => {
      const c = certCounts[e.id] || 0;
      const v = verifCounts[e.id] || 0;
      return {
        id: e.id,
        name: e.name,
        certificates: c,
        verifications: v,
        verificationRate: c ? Math.round((v / c) * 100) : 0,
      };
    });

    return ok(res, stats);
  }),
};
