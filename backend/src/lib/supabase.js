import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Service-role client. BYPASSES RLS — only use in trusted server code
 * (workers, webhooks, verification logging) and always scope queries by org_id
 * explicitly. Never expose this client's key to the frontend.
 */
const supabaseUrl = env.supabase.url || 'https://placeholder.supabase.co';
const supabaseServiceKey = env.supabase.serviceKey || 'placeholder-service-key';
const supabaseAnonKey = env.supabase.anonKey || 'placeholder-anon-key';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Build a per-request client that acts AS the authenticated user, so RLS
 * policies apply. Pass the user's access token from the Authorization header.
 */
export function supabaseForToken(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
