// End-to-end self-check for the certificate generation pipeline — runs OFFLINE
// (no Supabase/Redis needed). For each sample template it:
//   1. renders HTML via renderService (same renderer used for preview + PDF)
//   2. builds a QR data URL via qrService
//   3. produces a real PDF via pdfService (Puppeteer)
//   4. asserts every {{token}} was substituted (catches variable typos)
// Outputs land in backend/generated/ (gitignored).
//
// Usage:  node src/scripts/checkRender.js

import { mkdirSync, writeFileSync } from 'fs';
import { renderService } from '../services/renderService.js';
import { qrService } from '../services/qrService.js';
import { pdfService } from '../services/pdfService.js';
import { sampleTemplates } from '../data/sampleTemplates.js';

const OUT = 'generated';

const sample = {
  recipient_name: 'Aarav Sharma',
  recipient_email: 'aarav@example.com',
  event_name: 'Full Stack Web Development Bootcamp',
  course_name: 'Full Stack Web Development',
  organization_name: 'BulkCertifyX Academy',
  issued_by: 'Dr. Meera Nair',
  verification_code: 'CERT-A7K2-X9PQ',
  issue_date: new Date().toISOString().slice(0, 10),
  grade: 'A+',
};

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const qrDataUrl = await qrService.dataUrl(sample.verification_code);
  let failures = 0;

  for (const template of sampleTemplates) {
    const label = template.name;
    try {
      const html = renderService.buildHtml({ template, data: sample, qrDataUrl });

      // Catch any {{token}} that never got merged (typo'd variable name).
      const leftover = html.match(/\{\{\s*[\w.]+\s*\}\}/g);
      if (leftover) throw new Error(`unmerged tokens: ${leftover.join(', ')}`);

      writeFileSync(`${OUT}/${slug(label)}.html`, html);

      const raw = await pdfService.renderCertificate({ template, data: sample, qrDataUrl });
      const pdf = Buffer.from(raw); // page.pdf() may return a Uint8Array
      if (!pdf || pdf.length < 1000) throw new Error(`PDF too small (${pdf?.length} bytes)`);
      const isPdf = pdf.subarray(0, 5).toString('latin1') === '%PDF-';
      if (!isPdf) throw new Error('output is not a valid PDF');

      writeFileSync(`${OUT}/${slug(label)}.pdf`, pdf);
      console.log(`  OK   ${label.padEnd(28)} — ${(pdf.length / 1024).toFixed(1)} KB PDF`);
    } catch (err) {
      failures += 1;
      console.log(`  FAIL ${label.padEnd(28)} — ${err.message}`);
    }
  }

  await pdfService.close();
  console.log(
    failures === 0
      ? `\nAll ${sampleTemplates.length} templates rendered to PDF successfully. Output: ${OUT}/`
      : `\n${failures} template(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('check crashed:', err);
  process.exit(1);
});
