import QRCode from 'qrcode';
import { env } from '../config/env.js';

export const qrService = {
  verificationUrl(code, host) {
    const base = host || env.publicAppUrl;
    return `${base.replace(/\/$/, '')}/verify/${code}`;
  },

  /** Returns a PNG data URL suitable for embedding directly in HTML. */
  async dataUrl(code, host) {
    return QRCode.toDataURL(this.verificationUrl(code, host), {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 6,
      color: { dark: '#111827', light: '#ffffff' },
    });
  },
};
