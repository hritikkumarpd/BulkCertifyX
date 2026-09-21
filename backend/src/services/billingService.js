import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { PLANS } from '../config/plans.js';
import { logger } from '../lib/logger.js';

const razorpay = env.razorpay.keyId
  ? new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret })
  : null;

// Map tier+cycle -> configured Razorpay plan id.
function planId(tier, cycle) {
  return env.razorpay.plans[tier]?.[cycle] || '';
}

// Reverse-map a Razorpay plan id back to our tier/cycle for webhook handling.
function tierFromPlanId(rzpPlanId) {
  for (const tier of ['starter', 'pro', 'enterprise']) {
    for (const cycle of ['monthly', 'annual']) {
      if (env.razorpay.plans[tier]?.[cycle] === rzpPlanId) return { tier, cycle };
    }
  }
  return null;
}

export const billingService = {
  isConfigured: () => !!razorpay,

  /** Create a Razorpay subscription for the given plan/cycle. */
  async createSubscription({ orgId, tier, cycle }) {
    if (!razorpay) throw new Error('Billing is not configured.');
    if (!PLANS[tier] || tier === 'free') throw new Error('Invalid plan.');
    const rzpPlan = planId(tier, cycle);
    if (!rzpPlan) throw new Error(`No Razorpay plan configured for ${tier}/${cycle}.`);

    const sub = await razorpay.subscriptions.create({
      plan_id: rzpPlan,
      total_count: cycle === 'annual' ? 1 : 12,
      customer_notify: 1,
      notes: { org_id: orgId, tier, cycle },
    });

    await supabaseAdmin.from('subscriptions').upsert({
      org_id: orgId,
      plan: 'free', // stays free until webhook confirms activation
      status: 'incomplete',
      billing_cycle: cycle,
      razorpay_subscription_id: sub.id,
    }, { onConflict: 'org_id' });

    return { subscriptionId: sub.id, keyId: env.razorpay.keyId, shortUrl: sub.short_url };
  },

  async cancelSubscription({ orgId, atCycleEnd = true }) {
    if (!razorpay) throw new Error('Billing is not configured.');
    const { data: sub } = await supabaseAdmin.from('subscriptions').select('*').eq('org_id', orgId).maybeSingle();
    if (!sub?.razorpay_subscription_id) throw new Error('No active subscription.');
    await razorpay.subscriptions.cancel(sub.razorpay_subscription_id, atCycleEnd);
    await supabaseAdmin.from('subscriptions')
      .update({ cancel_at_period_end: atCycleEnd, status: atCycleEnd ? sub.status : 'cancelled' })
      .eq('org_id', orgId);
    return { cancelled: true, atCycleEnd };
  },

  /** Verify a Razorpay webhook signature (HMAC-SHA256). */
  verifyWebhookSignature(rawBody, signature) {
    if (!env.razorpay.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', env.razorpay.webhookSecret)
      .update(rawBody)
      .digest('hex');
    // timing-safe compare
    const a = Buffer.from(expected);
    const b = Buffer.from(signature || '');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  /**
   * Handle a verified webhook event. Idempotent: the razorpay event id is stored
   * uniquely in billing_events, so a replayed webhook is a no-op.
   */
  async handleWebhookEvent(event) {
    const eventId = event.id || event?.payload?.subscription?.entity?.id + ':' + event.event;

    // Idempotency guard.
    const { error: dupErr } = await supabaseAdmin.from('billing_events').insert({
      razorpay_event_id: eventId,
      type: event.event,
      raw: event,
      status: 'received',
    });
    if (dupErr && dupErr.code === '23505') {
      logger.info({ eventId }, 'duplicate webhook ignored');
      return { duplicate: true };
    }

    const sub = event?.payload?.subscription?.entity;
    const payment = event?.payload?.payment?.entity;

    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        if (sub) await this.activateFromSubscription(sub);
        if (payment) await this.recordPayment(sub, payment, 'paid');
        break;
      }
      case 'subscription.pending':
      case 'subscription.halted': {
        if (sub) await this.setStatus(sub.id, 'past_due');
        break;
      }
      case 'subscription.paused': {
        if (sub) await this.setStatus(sub.id, 'paused');
        break;
      }
      case 'subscription.cancelled':
      case 'subscription.completed': {
        if (sub) await this.downgradeToFree(sub.id);
        break;
      }
      case 'payment.failed': {
        if (payment) await this.recordPayment(sub, payment, 'failed');
        break;
      }
      default:
        logger.info({ type: event.event }, 'unhandled webhook type');
    }
    return { processed: true };
  },

  async activateFromSubscription(sub) {
    const mapped = tierFromPlanId(sub.plan_id) || { tier: 'starter', cycle: 'monthly' };
    const orgId = sub.notes?.org_id;
    const patch = {
      plan: mapped.tier,
      status: 'active',
      billing_cycle: mapped.cycle,
      cancel_at_period_end: false,
      current_period_end: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null,
      razorpay_customer_id: sub.customer_id || null,
    };
    const query = supabaseAdmin.from('subscriptions').update(patch);
    if (orgId) await query.eq('org_id', orgId);
    else await query.eq('razorpay_subscription_id', sub.id);

    // Keep org.plan snapshot in sync.
    const target = orgId ? { org_id: orgId } : { razorpay_subscription_id: sub.id };
    const { data: row } = await supabaseAdmin.from('subscriptions').select('org_id').match(target).maybeSingle();
    if (row) await supabaseAdmin.from('organizations').update({ plan: mapped.tier }).eq('id', row.org_id);
  },

  async setStatus(rzpSubId, status) {
    await supabaseAdmin.from('subscriptions').update({ status }).eq('razorpay_subscription_id', rzpSubId);
  },

  async downgradeToFree(rzpSubId) {
    const { data: row } = await supabaseAdmin.from('subscriptions')
      .update({ plan: 'free', status: 'cancelled' }).eq('razorpay_subscription_id', rzpSubId).select('org_id').maybeSingle();
    if (row) await supabaseAdmin.from('organizations').update({ plan: 'free' }).eq('id', row.org_id);
  },

  async recordPayment(sub, payment, status) {
    const orgId = sub?.notes?.org_id;
    let resolvedOrg = orgId;
    if (!resolvedOrg && sub?.id) {
      const { data } = await supabaseAdmin.from('subscriptions').select('org_id').eq('razorpay_subscription_id', sub.id).maybeSingle();
      resolvedOrg = data?.org_id;
    }
    if (!resolvedOrg) return;
    await supabaseAdmin.from('billing_events').insert({
      org_id: resolvedOrg,
      razorpay_event_id: `pay_${payment.id}`,
      type: 'payment',
      amount: payment.amount,
      currency: payment.currency,
      status,
      raw: payment,
    }).then(() => {}, () => {}); // ignore idempotency collisions
  },
};
