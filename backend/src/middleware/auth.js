import { supabaseAdmin, supabaseForToken } from '../lib/supabase.js';
import { Errors } from '../lib/errors.js';
import { asyncHandler } from './errorHandler.js';

/**
 * Authenticates the request via the Supabase JWT in the Authorization header.
 * Attaches:
 *   req.user  = { id, email }
 *   req.token = raw access token
 *   req.db    = RLS-scoped Supabase client acting as this user
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw Errors.unauthorized();

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw Errors.unauthorized('Invalid or expired session.');

  req.user = { id: data.user.id, email: data.user.email };
  req.token = token;
  req.db = supabaseForToken(token);
  next();
});

/**
 * Resolves the org context from the `x-org-id` header (or :orgId param) and
 * verifies the user is an active member. Attaches req.org = { id, role }.
 * Role is resolved SERVER-SIDE — never trusted from the client.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requireOrg = asyncHandler(async (req, _res, next) => {
  const orgId = req.headers['x-org-id'] || req.params.orgId;
  if (!orgId) throw Errors.badRequest('Organization context is required.');

  if (!UUID_REGEX.test(orgId)) {
    throw Errors.badRequest('Invalid organization ID format.');
  }

  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('role, status')
    .eq('org_id', orgId)
    .eq('user_id', req.user.id)
    .maybeSingle();

  if (error) throw Errors.internal();
  if (!data || data.status !== 'active') throw Errors.forbidden('You are not a member of this organization.');

  req.org = { id: orgId, role: data.role };
  next();
});

/** Guard a route to specific roles. Use after requireOrg. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.org || !roles.includes(req.org.role)) {
      return next(Errors.forbidden('Your role does not permit this action.'));
    }
    next();
  };
}
