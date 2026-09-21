import { supabaseAdmin } from '../lib/supabase.js';
import { generateVerificationCode } from '../utils/codes.js';
import { qrService } from './qrService.js';
import { pdfService } from './pdfService.js';
import { storageService } from './storageService.js';
import { auditService } from './auditService.js';
import { Errors } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// Build the standard variable set available to every template.
function buildFields(org, event, row) {
  const now = new Date();
  return {
    organization_name: org?.name || '',
    issued_by: event?.issued_by || org?.name || '',
    event_name: event?.name || '',
    event_date: event?.event_date || '',
    issue_date: now.toISOString().slice(0, 10),
    ...row, // recipient_name, recipient_email, and any custom columns
  };
}

export const certificateService = {
  /**
   * Create ONE certificate: reserve code, render PDF, upload, persist.
   * `reserveQuota` is false when the caller (bulk worker) already reserved.
   * Returns the certificate row.
   */
  async issueOne({ org, event, template, row, createdBy, expiresAt, host }) {
    if (!template) throw Errors.badRequest('A template is required to issue a certificate.');

    const code = generateVerificationCode();
    const fields = buildFields(org, event, row);
    const qrDataUrl = await qrService.dataUrl(code, host);

    // Render + upload PDF
    const pdfBuffer = await pdfService.renderCertificate({
      template,
      data: { ...fields, verification_code: code },
      qrDataUrl,
    });
    const path = storageService.path(org.id, 'certificates', `${code}.pdf`);
    await storageService.upload(path, pdfBuffer, 'application/pdf');

    const { data, error } = await supabaseAdmin
      .from('certificates')
      .insert({
        org_id: org.id,
        event_id: event?.id || null,
        template_id: template.id,
        verification_code: code,
        recipient_name: row.recipient_name || row.name || 'Recipient',
        recipient_email: row.recipient_email || row.email || null,
        fields,
        pdf_url: path,
        expires_at: expiresAt || null,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) {
      // Roll back the orphaned PDF on DB failure.
      await storageService.remove([path]).catch(() => {});
      logger.error({ err: error }, 'certificate insert failed');
      throw Errors.internal('Failed to save certificate.');
    }
    return data;
  },

  /** Single-certificate flow from the dashboard — reserves quota itself. */
  async issueSingle({ orgId, eventId, templateId, recipient, expiresAt, createdBy, host, usageService }) {
    await usageService.reserveCertificates(orgId, 1);
    try {
      const [{ data: org }, { data: event }, { data: template }] = await Promise.all([
        supabaseAdmin.from('organizations').select('*').eq('id', orgId).single(),
        eventId ? supabaseAdmin.from('events').select('*').eq('id', eventId).eq('org_id', orgId).maybeSingle() : Promise.resolve({ data: null }),
        supabaseAdmin.from('templates').select('*').eq('id', templateId).eq('org_id', orgId).maybeSingle(),
      ]);
      if (!template) throw Errors.notFound('Template not found.');

      const cert = await this.issueOne({
        org,
        event,
        template,
        row: recipient,
        createdBy,
        expiresAt,
        host,
      });
      await auditService.log({ orgId, userId: createdBy, action: 'certificate.created', resourceType: 'certificate', resourceId: cert.id });
      return cert;
    } catch (err) {
      // Release the reserved slot on failure so it isn't silently consumed.
      await usageService.releaseCertificates(orgId, 1).catch(() => {});
      throw err;
    }
  },

  async revoke({ orgId, certificateId, reason, userId }) {
    const { data, error } = await supabaseAdmin
      .from('certificates')
      .update({ status: 'revoked', revoked_at: new Date().toISOString(), revoke_reason: reason || null })
      .eq('id', certificateId)
      .eq('org_id', orgId)
      .select()
      .single();
    if (error || !data) throw Errors.notFound('Certificate not found.');
    await auditService.log({ orgId, userId, action: 'certificate.revoked', resourceType: 'certificate', resourceId: certificateId, metadata: { reason } });
    return data;
  },

  /** Derive the effective status (valid/revoked/expired) at read time. */
  deriveStatus(cert) {
    if (cert.status === 'revoked') return 'revoked';
    if (cert.expires_at && new Date(cert.expires_at) < new Date()) return 'expired';
    return 'valid';
  },
};
