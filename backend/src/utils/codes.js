import { customAlphabet } from 'nanoid';
import crypto from 'node:crypto';

// Unambiguous alphabet (no 0/O/1/I) for human-readable verification codes.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const segment = customAlphabet(alphabet, 4);

/** e.g. CERT-A7K2-X9PQ */
export function generateVerificationCode() {
  return `CERT-${segment()}-${segment()}`;
}

/** Current usage period key, e.g. "2026-09". */
export function currentPeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Generate a full API key + its prefix + sha256 hash for storage. */
export function generateApiKey() {
  const raw = `bcx_${crypto.randomBytes(24).toString('base64url')}`;
  const prefix = raw.slice(0, 12);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, prefix, hash };
}

export function hashApiKey(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Cryptographically secure single-use token (invites, domain verification). */
export function secureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
