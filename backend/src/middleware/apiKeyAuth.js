import { supabaseAdmin } from '../lib/supabase.js';
import { Errors } from '../lib/errors.js';
import { asyncHandler } from './errorHandler.js';
import { hashApiKey } from '../utils/codes.js';

/**
 * Authenticates public API (/api/v1) requests via a bearer API key.
 * Looks up the sha256 hash, checks it isn't revoked, and attaches
 * req.apiOrgId + req.apiPermissions. Updates last_used_at (fire-and-forget).
 */
export const requireApiKey = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const raw = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!raw || !raw.startsWith('bcx_')) throw Errors.invalidApiKey();

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, org_id, permissions, revoked_at')
    .eq('key_hash', hashApiKey(raw))
    .maybeSingle();

  if (error) throw Errors.internal();
  if (!data || data.revoked_at) throw Errors.invalidApiKey();

  req.apiOrgId = data.org_id;
  req.apiPermissions = data.permissions || [];

  // best-effort usage timestamp; never block the request on it
  supabaseAdmin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(
    () => {},
    () => {},
  );

  next();
});

/** Require a specific permission scope on the API key. */
export function requireScope(scope) {
  return (req, _res, next) => {
    if (!req.apiPermissions?.includes(scope)) {
      return next(Errors.forbidden(`This API key lacks the '${scope}' permission.`));
    }
    next();
  };
}
