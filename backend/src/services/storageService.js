import { supabaseAdmin } from '../lib/supabase.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const BUCKET = env.supabase.bucket;

/**
 * Consistent storage paths, all namespaced by org for isolation:
 *   organizations/{orgId}/templates/...
 *   organizations/{orgId}/certificates/...
 *   organizations/{orgId}/bulk/...
 *   organizations/{orgId}/logos/...
 */
// Strip anything that could escape the org-namespaced prefix (path traversal).
function safeSegment(value) {
  return String(value ?? '').replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '_');
}

export const storageService = {
  path(orgId, kind, filename) {
    // orgId and kind are server-controlled; filename is sanitized defensively so
    // a future caller passing user input cannot traverse out of the org prefix.
    return `organizations/${safeSegment(orgId)}/${safeSegment(kind)}/${safeSegment(filename)}`;
  },

  async upload(path, body, contentType) {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, body, { contentType, upsert: true });
    if (error) {
      logger.error({ err: error, path }, 'storage upload failed');
      throw new Error(`Storage upload failed: ${error.message}`);
    }
    return path;
  },

  /** Time-limited signed URL — credentials are never exposed. */
  async signedUrl(path, expiresIn = 60 * 60) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    if (error) throw new Error(`Signed URL failed: ${error.message}`);
    return data.signedUrl;
  },

  async remove(paths) {
    if (!paths?.length) return;
    await supabaseAdmin.storage.from(BUCKET).remove(paths);
  },

  async download(path) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
    if (error) throw new Error(`Storage download failed: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  },
};
