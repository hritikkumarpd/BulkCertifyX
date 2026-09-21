import { Errors } from '../lib/errors.js';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Minimal, safe CSV parser (RFC-4180-ish): handles quoted fields, embedded
 * commas, escaped quotes, and CRLF. No eval, no external formula execution.
 */
export function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // ignore; handled with \n
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export const csvService = {
  /** Validate file, parse, and return { headers, rows } (rows are objects). */
  parse({ buffer, size }) {
    if (size > MAX_BYTES) throw Errors.badRequest('CSV exceeds the 5 MB limit.');
    const text = buffer.toString('utf8').replace(/^\uFEFF/, ''); // strip BOM
    const matrix = parseCsv(text);
    if (matrix.length < 2) throw Errors.badRequest('CSV must have a header row and at least one data row.');

    const headers = matrix[0].map((h) => h.trim());
    const rows = matrix.slice(1).map((cells) => {
      const obj = {};
      headers.forEach((h, idx) => {
        const key = String(h).trim();
        if (key && key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
          obj[key] = (cells[idx] ?? '').trim();
        }
      });
      return obj;
    });
    return { headers, rows };
  },

  /**
   * Apply a column map (certificateField -> csvColumn) and validate each row.
   * Returns { mapped: [{data, errors}], validCount, errorCount }.
   */
  validate({ rows, columnMap }) {
    const seenEmails = new Set();
    const mapped = rows.map((raw) => {
      const data = {};
      for (const [field, col] of Object.entries(columnMap)) {
        if (col) data[field] = raw[col] ?? '';
      }
      const errors = [];
      if (!data.recipient_name) errors.push('Missing recipient name');
      if (data.recipient_email) {
        if (!EMAIL_RE.test(data.recipient_email)) errors.push('Invalid email');
        else if (seenEmails.has(data.recipient_email.toLowerCase())) errors.push('Duplicate email');
        else seenEmails.add(data.recipient_email.toLowerCase());
      }
      return { data, errors, valid: errors.length === 0 };
    });
    return {
      mapped,
      validCount: mapped.filter((m) => m.valid).length,
      errorCount: mapped.filter((m) => !m.valid).length,
    };
  },

  /** Suggest an automatic column mapping by fuzzy header matching. */
  autoMap(headers) {
    const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
    const targets = {
      recipient_name: ['name', 'fullname', 'recipientname', 'recipient'],
      recipient_email: ['email', 'emailaddress', 'mail'],
      course_name: ['course', 'coursename', 'training', 'program'],
      event_date: ['date', 'completiondate', 'eventdate'],
      grade: ['grade', 'score', 'result'],
    };
    const map = {};
    for (const [field, aliases] of Object.entries(targets)) {
      const hit = headers.find((h) => aliases.includes(norm(h)));
      if (hit) map[field] = hit;
    }
    return map;
  },
};
