import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/**
 * Append-only audit trail. Writes use the service role (bypassing RLS) so that
 * ordinary users can never fabricate or edit entries — they can only read their
 * org's log via the audit_read RLS policy.
 */
export const auditService = {
  async log({ orgId, userId, action, resourceType = null, resourceId = null, metadata = {} }) {
    try {
      await supabaseAdmin.from('audit_logs').insert({
        org_id: orgId,
        user_id: userId || null,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        metadata,
      });
    } catch (err) {
      // Auditing must never break the primary operation.
      logger.warn({ err, action }, 'audit log write failed');
    }
  },

  async list(orgId, { limit = 50, action } = {}) {
    let q = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (action) q = q.eq('action', action);
    const { data } = await q;
    return data || [];
  },
};
