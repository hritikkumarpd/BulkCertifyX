import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const resend = env.resend.apiKey ? new Resend(env.resend.apiKey) : null;

// Basic sanitizer: strip script/style/event handlers from org-provided HTML.
function sanitize(html) {
  return String(html || '')
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function certificateEmailHtml({ recipientName, eventName, orgName, brandColor, verifyUrl, downloadUrl, footer }) {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;color:#111827;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
      <div style="height:4px;width:48px;background:${brandColor || '#4F46E5'};border-radius:2px;margin-bottom:24px;"></div>
      <h1 style="font-size:20px;margin:0 0 8px;">Congratulations, ${recipientName}.</h1>
      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Your certificate for <strong>${eventName}</strong> from ${orgName} has been issued.
      </p>
      <a href="${downloadUrl}" style="display:inline-block;background:${brandColor || '#4F46E5'};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">Download certificate</a>
      <p style="margin:24px 0 0;font-size:14px;">
        <a href="${verifyUrl}" style="color:${brandColor || '#4F46E5'};">Verify this certificate</a>
      </p>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:20px;">${sanitize(footer || 'Powered by BulkCertifyX')}</p>
  </div></body></html>`;
}

export const emailService = {
  async sendCertificate({ to, recipientName, eventName, orgName, brandColor, verifyUrl, downloadUrl, footer, from }) {
    if (!resend) {
      logger.warn('Resend not configured — skipping email send (dev).');
      return { skipped: true };
    }
    const { data, error } = await resend.emails.send({
      from: from || env.resend.from,
      to,
      subject: `Your certificate from ${orgName}`,
      html: certificateEmailHtml({ recipientName, eventName, orgName, brandColor, verifyUrl, downloadUrl, footer }),
    });
    if (error) throw new Error(error.message || 'Email send failed');
    return data;
  },

  async sendInvite({ to, orgName, inviteUrl, from }) {
    if (!resend) { logger.warn('Resend not configured — skipping invite email (dev).'); return { skipped: true }; }
    const { data, error } = await resend.emails.send({
      from: from || env.resend.from,
      to,
      subject: `You've been invited to join ${orgName} on BulkCertifyX`,
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;">
        <h2>Join ${orgName}</h2>
        <p style="color:#64748b;">You've been invited to collaborate on BulkCertifyX.</p>
        <a href="${inviteUrl}" style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Accept invitation</a>
        <p style="color:#94a3b8;font-size:12px;margin-top:16px;">This invitation expires in 7 days.</p>
      </div>`,
    });
    if (error) throw new Error(error.message || 'Invite email failed');
    return data;
  },
};
