import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ok, created } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { secureToken } from '../utils/codes.js';
import { usageService } from '../services/usageService.js';
import { auditService } from '../services/auditService.js';
import { getPlan } from '../config/plans.js';
import dns from 'node:dns/promises';

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export const domainController = {
  list: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin.from('custom_domains').select('*').eq('org_id', req.org.id);
    return ok(res, data || []);
  }),

  add: asyncHandler(async (req, res) => {
    const tier = await usageService.getPlanTier(req.org.id);
    if (!getPlan(tier).features.customDomain) {
      throw Errors.forbidden('Custom domains are available on the Pro and Enterprise plans.');
    }
    const { hostname } = z.object({ hostname: z.string().toLowerCase() }).parse(req.body);
    if (!HOSTNAME_RE.test(hostname)) throw Errors.badRequest('Invalid hostname format.');

    // Global uniqueness prevents one domain belonging to two orgs (anti-hijack).
    const { data: existing } = await supabaseAdmin.from('custom_domains').select('id').eq('hostname', hostname).maybeSingle();
    if (existing) throw Errors.conflict('This domain is already registered.');

    const token = `bcx-verify=${secureToken(16)}`;
    const { data, error } = await supabaseAdmin
      .from('custom_domains')
      .insert({ org_id: req.org.id, hostname, verification_token: token })
      .select().single();
    if (error) throw Errors.internal('Failed to add domain.');

    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'domain.added', resourceType: 'domain', resourceId: data.id, metadata: { hostname } });
    return created(res, {
      ...data,
      instructions: {
        type: 'TXT',
        name: `_bulkcertifyx.${hostname}`,
        value: token,
        cname: { name: hostname, value: 'verify.bulkcertifyx.com' },
      },
    });
  }),

  verify: asyncHandler(async (req, res) => {
    const { data: domain } = await supabaseAdmin
      .from('custom_domains').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!domain) throw Errors.notFound('Domain not found.');

    // Real DNS TXT lookup for the verification token.
    let verified = false;
    try {
      const records = await dns.resolveTxt(`_bulkcertifyx.${domain.hostname}`);
      verified = records.flat().some((r) => r.includes(domain.verification_token));
    } catch {
      verified = false;
    }
    if (!verified) throw Errors.badRequest('Verification TXT record not found yet. DNS changes can take time to propagate.');

    await supabaseAdmin.from('custom_domains')
      .update({ verified: true, verified_at: new Date().toISOString() }).eq('id', domain.id);
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'domain.verified', resourceType: 'domain', resourceId: domain.id });
    return ok(res, { verified: true });
  }),

  remove: asyncHandler(async (req, res) => {
    await supabaseAdmin.from('custom_domains').delete().eq('id', req.params.id).eq('org_id', req.org.id);
    return ok(res, { removed: true });
  }),
};
