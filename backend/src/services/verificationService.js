import { supabaseAdmin } from '../lib/supabase.js';
import { certificateService } from './certificateService.js';

// Fields that are surfaced through dedicated, intentionally-public response
// keys (recipientName / eventName / issuedBy / dates). They never need to
// appear again inside the generic `fields` map.
const SURFACED_KEYS = new Set([
  'recipient_name', 'event_name', 'issued_by', 'issue_date', 'event_date',
  'organization_name', 'verification_code',
]);

// Hard denylist of contact/PII keys that must NEVER be public, even if a
// template author references them. Belt-and-suspenders on top of the allowlist.
const PII_KEYS = new Set([
  'recipient_email', 'email', 'phone', 'mobile', 'address', 'dob',
  'date_of_birth', 'national_id', 'aadhaar', 'ssn', 'pan',
]);

/** Extract every {{token}} variable name referenced by a template design. */
export function extractTemplateTokens(design) {
  const tokens = new Set();
  const elements = design?.elements || [];
  for (const el of elements) {
    if (typeof el?.text !== 'string') continue;
    for (const m of el.text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
      tokens.add(m[1]);
    }
  }
  return tokens;
}

/**
 * Build the public `fields` map: ONLY values that (a) the template actually
 * prints on the certificate and (b) are not surfaced elsewhere or on the PII
 * denylist. This is an allowlist — a column the org never rendered stays private.
 */
export function publicFieldsFor(fields = {}, tokenNames = new Set()) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SURFACED_KEYS.has(key) || PII_KEYS.has(key)) continue;
    if (tokenNames.has(key)) out[key] = value;
  }
  return out;
}

/**
 * Public verification. Extremely fast (indexed verification_code lookup) and
 * deliberately minimal in what it exposes — no internal IDs, no private org
 * data beyond the certificate's public content and issuing org identity.
 */
export const verificationService = {
  async verify(code, meta = {}) {
    const { data: cert } = await supabaseAdmin
      .from('certificates')
      .select(
        'id, org_id, verification_code, recipient_name, fields, status, issued_at, expires_at, revoked_at, revoke_reason, event_id, template_id',
      )
      .eq('verification_code', code)
      .maybeSingle();

    if (!cert) return { result: 'not_found' };

    const status = certificateService.deriveStatus(cert);

    // Fetch public-safe org branding, event name, and the template design so we
    // can restrict `fields` to exactly what the certificate actually displays.
    const [{ data: org }, { data: event }, { data: template }] = await Promise.all([
      supabaseAdmin.from('organizations').select('name, brand_name, logo_url, brand_color, white_label').eq('id', cert.org_id).single(),
      cert.event_id ? supabaseAdmin.from('events').select('name, issued_by').eq('id', cert.event_id).maybeSingle() : Promise.resolve({ data: null }),
      cert.template_id ? supabaseAdmin.from('templates').select('design').eq('id', cert.template_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    // Fire-and-forget analytics — verification must not fail if logging does.
    if (status === 'valid') {
      supabaseAdmin.rpc('increment_verification', { p_cert_id: cert.id }).then(() => {}, () => {});
      supabaseAdmin
        .from('verification_logs')
        .insert({ certificate_id: cert.id, org_id: cert.org_id, user_agent: meta.userAgent, referer: meta.referer })
        .then(() => {}, () => {});
    }

    // Allowlist: only fields the template renders are considered public.
    const tokens = extractTemplateTokens(template?.design);
    const safeFields = publicFieldsFor(cert.fields, tokens);

    return {
      result: status, // valid | revoked | expired
      certificate: {
        code: cert.verification_code,
        recipientName: cert.recipient_name,
        eventName: event?.name || cert.fields?.event_name || null,
        issuedBy: event?.issued_by || cert.fields?.issued_by || org?.name,
        issuedAt: cert.issued_at,
        expiresAt: cert.expires_at,
        revokedAt: cert.revoked_at,
        revokeReason: status === 'revoked' ? cert.revoke_reason : undefined,
        fields: safeFields,
      },
      organization: {
        name: org?.white_label && org?.brand_name ? org.brand_name : org?.name,
        logoUrl: org?.logo_url,
        brandColor: org?.brand_color,
        whiteLabel: !!org?.white_label,
      },
    };
  },
};
