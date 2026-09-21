import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { ok, created } from '../utils/respond.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Errors } from '../lib/errors.js';
import { generateApiKey } from '../utils/codes.js';
import { auditService } from '../services/auditService.js';

const PERMISSIONS = ['certificates:read', 'certificates:write', 'verify:read', 'events:read'];

export const apiKeyController = {
  list: asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, key_prefix, permissions, last_used_at, revoked_at, created_at')
      .eq('org_id', req.org.id)
      .order('created_at', { ascending: false });
    return ok(res, data || []);
  }),

  create: asyncHandler(async (req, res) => {
    const { name, permissions } = z.object({
      name: z.string().min(1).max(80),
      permissions: z.array(z.enum(PERMISSIONS)).min(1),
    }).parse(req.body);

    const { raw, prefix, hash } = generateApiKey();
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({ org_id: req.org.id, name, key_prefix: prefix, key_hash: hash, permissions, created_by: req.user.id })
      .select('id, name, key_prefix, permissions, created_at')
      .single();
    if (error) throw Errors.internal('Failed to create API key.');

    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'apikey.created', resourceType: 'api_key', resourceId: data.id });
    // The full key is returned exactly ONCE. Only its hash is stored.
    return created(res, { ...data, key: raw });
  }),

  revoke: asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('api_keys').update({ revoked_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('org_id', req.org.id).select('id').single();
    if (error || !data) throw Errors.notFound('API key not found.');
    await auditService.log({ orgId: req.org.id, userId: req.user.id, action: 'apikey.revoked', resourceType: 'api_key', resourceId: req.params.id });
    return ok(res, { revoked: true });
  }),
};
