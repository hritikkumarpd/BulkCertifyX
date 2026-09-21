import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ok, created } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { auditService } from '../services/auditService.js';

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 62);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(62).optional(),
});

export const organizationController = {
  // List orgs the current user belongs to (used to populate the org switcher).
  list: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('organization_members')
      .select('role, organizations(*)')
      .eq('user_id', req.user.id)
      .eq('status', 'active');
    const orgs = (data || []).map((m) => ({ ...m.organizations, role: m.role }));
    return ok(res, orgs);
  }),

  create: asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    let slug = body.slug ? slugify(body.slug) : slugify(body.name);

    // Ensure slug uniqueness.
    const { data: existing } = await supabaseAdmin.from('organizations').select('id').eq('slug', slug).maybeSingle();
    if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .insert({ name: body.name, slug, created_by: req.user.id, contact_email: req.user.email })
      .select()
      .single();
    if (error) throw Errors.internal('Failed to create organization.');

    // Creator becomes owner.
    await supabaseAdmin.from('organization_members').insert({
      org_id: org.id, user_id: req.user.id, email: req.user.email,
      role: 'owner', status: 'active', joined_at: new Date().toISOString(),
    });
    // Seed a free subscription row.
    await supabaseAdmin.from('subscriptions').insert({ org_id: org.id, plan: 'free', status: 'active' });

    await auditService.log({ orgId: org.id, userId: req.user.id, action: 'org.created', resourceType: 'organization', resourceId: org.id });
    return created(res, { ...org, role: 'owner' });
  }),

  get: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin.from('organizations').select('*').eq('id', req.org.id).single();
    return ok(res, { ...data, role: req.org.role });
  }),

  update: asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().min(2).max(120).optional(),
      logo_url: z.string().url().nullish(),
      website: z.string().url().nullish(),
      contact_email: z.string().email().nullish(),
      address: z.string().max(500).nullish(),
      timezone: z.string().max(64).optional(),
      brand_name: z.string().max(120).nullish(),
      brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      footer_text: z.string().max(300).nullish(),
      white_label: z.boolean().optional(),
    });
    const patch = schema.parse(req.body);
    const { data, error } = await supabaseAdmin
      .from('organizations').update(patch).eq('id', req.org.id).select().single();
    if (error) throw Errors.internal('Failed to update organization.');
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'org.updated', resourceType: 'organization', resourceId: req.org.id });
    return ok(res, data);
  }),
};
