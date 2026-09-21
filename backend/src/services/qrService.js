import QRCode from 'qrcode';
import { env } from '../config/env.js';

export const qrService = {
  verificationUrl(code, host) {
    let base = host || env.publicAppUrl || env.frontendUrl;
    if (!/^https?:\/\//i.test(base)) {
      base = env.isProd ? `https://${base}` : `http://${base}`;
    }
    return `${base.replace(/\/+$/, '')}/verify/${code}`;
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
