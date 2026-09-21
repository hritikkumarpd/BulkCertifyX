import { supabaseAdmin } from '../lib/supabase.js';
import { getPlan } from '../config/plans.js';
import { currentPeriod } from '../utils/codes.js';
import { Errors } from '../lib/errors.js';

/**
 * Centralized usage/quota engine. All limit logic lives here so it is never
 * duplicated or bypassed.
 */
export const usageService = {
  /** Resolve the org's effective plan from the verified subscriptions table. */
  async getPlanTier(orgId) {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('plan, status')
      .eq('org_id', orgId)
      .maybeSingle();
    // Only an active/past_due subscription grants the paid tier; otherwise free.
    if (data && ['active', 'past_due'].includes(data.status)) return data.plan;
    return 'free';
  },

  /** Full usage snapshot for the dashboard. */
  async getSnapshot(orgId) {
    const tier = await this.getPlanTier(orgId);
    const plan = getPlan(tier);
    const period = currentPeriod();

    const [{ data: counter }, { count: templateCount }, { count: memberCount }, { count: totalCerts }] =
      await Promise.all([
        supabaseAdmin.from('usage_counters').select('certificates, emails').eq('org_id', orgId).eq('period', period).maybeSingle(),
        supabaseAdmin.from('templates').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
        supabaseAdmin.from('organization_members').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
        supabaseAdmin.from('certificates').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      ]);

    const used = counter?.certificates || 0;
    const limit = plan.limits.certificatesPerMonth;
    return {
      plan: tier,
      period,
      certificates: {
        used,
        limit,
        remaining: limit < 0 ? -1 : Math.max(0, limit - used),
      },
      emails: counter?.emails || 0,
      templates: { used: templateCount || 0, limit: plan.limits.templates },
      teamMembers: { used: memberCount || 0, limit: plan.limits.teamMembers },
      totalCertificates: totalCerts || 0,
      bulkPerJob: plan.limits.bulkPerJob,
      features: plan.features,
    };
  },

  /**
   * Atomically reserve quota for `amount` certificates. Concurrency-safe via the
   * reserve_certificate_quota SQL function — two simultaneous jobs cannot overshoot.
   * Throws QUOTA_EXCEEDED if there isn't room. Returns the period used.
   */
  async reserveCertificates(orgId, amount) {
    const tier = await this.getPlanTier(orgId);
    const plan = getPlan(tier);
    const period = currentPeriod();
    const limit = plan.limits.certificatesPerMonth;

    const { data, error } = await supabaseAdmin.rpc('reserve_certificate_quota', {
      p_org_id: orgId,
      p_period: period,
      p_amount: amount,
      p_limit: limit,
    });
    if (error) throw Errors.internal('Failed to reserve quota.');
    if (data !== true) {
      throw Errors.quotaExceeded(
        `This would exceed your monthly limit of ${limit} certificates. Upgrade your plan to continue.`,
      );
    }
    return period;
  },

  /** Release previously-reserved quota (e.g. permanently failed rows). */
  async releaseCertificates(orgId, amount, period = currentPeriod()) {
    if (amount <= 0) return;
    await supabaseAdmin.rpc('release_certificate_quota', {
      p_org_id: orgId,
      p_period: period,
      p_amount: amount,
    });
  },

  /** Enforce the per-job bulk cap before enqueuing. */
  async assertBulkAllowed(orgId, rowCount) {
    const tier = await this.getPlanTier(orgId);
    const plan = getPlan(tier);
    const cap = plan.limits.bulkPerJob;
    if (cap >= 0 && rowCount > cap) {
      throw Errors.quotaExceeded(
        `Your plan allows up to ${cap} certificates per bulk job. This file has ${rowCount} rows.`,
      );
    }
  },

  /** Enforce the template count cap before creating a new template. */
  async assertTemplateAllowed(orgId) {
    const tier = await this.getPlanTier(orgId);
    const plan = getPlan(tier);
    const cap = plan.limits.templates;
    if (cap < 0) return;
    const { count } = await supabaseAdmin
      .from('templates')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);
    if ((count || 0) >= cap) {
      throw Errors.quotaExceeded(`Your plan allows up to ${cap} template(s). Upgrade to add more.`);
    }
  },

  async incrementEmails(orgId, amount = 1) {
    if (amount <= 0) return;
    await supabaseAdmin.rpc('increment_email_usage', {
      p_org_id: orgId,
      p_period: currentPeriod(),
      p_amount: amount,
    });
  },
};
