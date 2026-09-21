import { supabaseAdmin } from '../lib/supabase.js';
import { certificateService } from './certificateService.js';

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

    // Fetch public-safe org branding + event name.
    const [{ data: org }, { data: event }] = await Promise.all([
      supabaseAdmin.from('organizations').select('name, brand_name, logo_url, brand_color, white_label').eq('id', cert.org_id).single(),
      cert.event_id ? supabaseAdmin.from('events').select('name, issued_by').eq('id', cert.event_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    // Fire-and-forget analytics — verification must not fail if logging does.
    if (status === 'valid') {
      supabaseAdmin.rpc('increment_verification', { p_cert_id: cert.id }).then(() => {}, () => {});
      supabaseAdmin
        .from('verification_logs')
        .insert({ certificate_id: cert.id, org_id: cert.org_id, user_agent: meta.userAgent, referer: meta.referer })
        .then(() => {}, () => {});
    }

    // Filter private contact info (PII) from public verification payload
    const safeFields = { ...(cert.fields || {}) };
    delete safeFields.recipient_email;
    delete safeFields.email;
    delete safeFields.phone;
    delete safeFields.mobile;
    delete safeFields.address;

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
