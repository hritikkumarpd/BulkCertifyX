import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ok, created } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { secureToken, hashToken } from '../utils/codes.js';
import { emailService } from '../services/emailService.js';
import { usageService } from '../services/usageService.js';
import { auditService } from '../services/auditService.js';
import { getPlan } from '../config/plans.js';
import { env } from '../config/env.js';

export const teamController = {
  list: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('organization_members')
      .select('id, email, role, status, joined_at, created_at, user_id')
      .eq('org_id', req.org.id)
      .order('created_at');
    return ok(res, data || []);
  }),

  invite: asyncHandler(async (req, res) => {
    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'member']),
    }).parse(req.body);

    // Enforce team-size limit.
    const tier = await usageService.getPlanTier(req.org.id);
    const cap = getPlan(tier).limits.teamMembers;
    if (cap >= 0) {
      const { count } = await supabaseAdmin
        .from('organization_members').select('id', { count: 'exact', head: true }).eq('org_id', req.org.id);
      if ((count || 0) >= cap) throw Errors.quotaExceeded(`Your plan allows up to ${cap} team member(s).`);
    }

    const { data: existing } = await supabaseAdmin
      .from('organization_members').select('id, status').eq('org_id', req.org.id).eq('email', email).maybeSingle();
    if (existing && existing.status === 'active') throw Errors.conflict('That person is already a member.');

    const raw = secureToken();
    const inviteExpires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const record = {
      org_id: req.org.id, email, role, status: 'invited',
      invited_by: req.user.id, invite_token: hashToken(raw), invite_expires_at: inviteExpires,
    };

    if (existing) {
      await supabaseAdmin.from('organization_members').update(record).eq('id', existing.id);
    } else {
      await supabaseAdmin.from('organization_members').insert(record);
    }

    const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', req.org.id).single();
    const inviteUrl = `${env.frontendUrl}/invite/${raw}`;
    await emailService.sendInvite({ to: email, orgName: org.name, inviteUrl }).catch(() => {});

    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'member.invited', resourceType: 'member', metadata: { email, role } });
    return created(res, { email, role, status: 'invited' });
  }),

  resend: asyncHandler(async (req, res) => {
    const { data: member } = await supabaseAdmin
      .from('organization_members').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!member || member.status !== 'invited') throw Errors.badRequest('No pending invitation for this member.');
    const raw = secureToken();
    await supabaseAdmin.from('organization_members')
      .update({ invite_token: hashToken(raw), invite_expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() })
      .eq('id', member.id);
    const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', req.org.id).single();
    await emailService.sendInvite({ to: member.email, orgName: org.name, inviteUrl: `${env.frontendUrl}/invite/${raw}` }).catch(() => {});
    return ok(res, { resent: true });
  }),

  changeRole: asyncHandler(async (req, res) => {
    const { role } = z.object({ role: z.enum(['owner', 'admin', 'member']) }).parse(req.body);
    const { data: member } = await supabaseAdmin
      .from('organization_members').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!member) throw Errors.notFound('Member not found.');

    // Only an owner may create another owner or demote an owner.
    if ((role === 'owner' || member.role === 'owner') && req.org.role !== 'owner') {
      throw Errors.forbidden('Only an owner can change owner roles.');
    }
    await supabaseAdmin.from('organization_members').update({ role }).eq('id', member.id);
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'member.role_changed', resourceType: 'member', resourceId: member.id, metadata: { role } });
    return ok(res, { id: member.id, role });
  }),

  remove: asyncHandler(async (req, res) => {
    const { data: member } = await supabaseAdmin
      .from('organization_members').select('*').eq('id', req.params.id).eq('org_id', req.org.id).maybeSingle();
    if (!member) throw Errors.notFound('Member not found.');
    if (member.role === 'owner') throw Errors.badRequest('The owner cannot be removed. Transfer ownership first.');
    await supabaseAdmin.from('organization_members').delete().eq('id', member.id);
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'member.removed', resourceType: 'member', resourceId: member.id });
    return ok(res, { removed: true });
  }),

  // Accept an invitation (authenticated user redeems a token).
  accept: asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.body);
    const { data: member } = await supabaseAdmin
      .from('organization_members').select('*').eq('invite_token', hashToken(token)).maybeSingle();
    if (!member) throw Errors.badRequest('Invalid or expired invitation.');
    if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
      throw Errors.badRequest('This invitation has expired.');
    }
    if (member.email.toLowerCase() !== req.user.email.toLowerCase()) {
      throw Errors.forbidden('This invitation was sent to a different email address.');
    }
    await supabaseAdmin.from('organization_members')
      .update({ user_id: req.user.id, status: 'active', joined_at: new Date().toISOString(), invite_token: null, invite_expires_at: null })
      .eq('id', member.id);
    await auditService.log({ orgId: member.org_id, userId: req.user.id, action: 'member.joined', resourceType: 'member', resourceId: member.id });
    return ok(res, { org_id: member.org_id });
  }),
};
