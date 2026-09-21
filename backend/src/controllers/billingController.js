import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ok } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { billingService } from '../services/billingService.js';
import { auditService } from '../services/auditService.js';
import { PLANS } from '../config/plans.js';

export const billingController = {
  // Public plan catalog (no auth needed for pricing page).
  plans: asyncHandler(async (_req, res) => ok(res, PLANS)),

  overview: asyncHandler(async (req, res) => {
    const { data: sub } = await supabaseAdmin.from('subscriptions').select('*').eq('org_id', req.org.id).maybeSingle();
    const { data: history } = await supabaseAdmin
      .from('billing_events').select('id, type, amount, currency, status, invoice_url, created_at')
      .eq('org_id', req.org.id).order('created_at', { ascending: false }).limit(50);
    return ok(res, {
      subscription: sub || { plan: 'free', status: 'active' },
      configured: billingService.isConfigured(),
      history: history || [],
    });
  }),

  subscribe: asyncHandler(async (req, res) => {
    const { tier, cycle } = z.object({
      tier: z.enum(['starter', 'pro', 'enterprise']),
      cycle: z.enum(['monthly', 'annual']),
    }).parse(req.body);
    if (!billingService.isConfigured()) throw Errors.badRequest('Billing is not configured on this server.');
    const result = await billingService.createSubscription({ orgId: req.org.id, tier, cycle });
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'subscription.initiated', metadata: { tier, cycle } });
    return ok(res, result);
  }),

  cancel: asyncHandler(async (req, res) => {
    const atCycleEnd = req.body?.immediately !== true;
    const result = await billingService.cancelSubscription({ orgId: req.org.id, atCycleEnd });
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'subscription.cancelled', metadata: { atCycleEnd } });
    return ok(res, result);
  }),

  // Razorpay webhook — signature-verified, raw body required. Mounted separately.
  webhook: asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody; // captured by express.json verify hook
    if (!billingService.verifyWebhookSignature(rawBody, signature)) {
      throw Errors.unauthorized('Invalid webhook signature.');
    }
    const result = await billingService.handleWebhookEvent(req.body);
    return ok(res, result);
  }),
};
