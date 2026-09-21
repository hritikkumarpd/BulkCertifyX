import puppeteer from 'puppeteer';
import { renderService } from './renderService.js';
import { logger } from '../lib/logger.js';

/**
 * Reusable Puppeteer engine. A single browser instance is shared across renders
 * (launching a browser per certificate would be catastrophically slow). Pages
 * are created and closed per render, and a simple semaphore bounds concurrency
 * so bulk jobs don't exhaust memory.
 */
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    });
  }
  return browserPromise;
}

// Bound concurrent page renders (env-tunable for worker sizing).
const MAX_CONCURRENT = Number(process.env.PDF_CONCURRENCY || 3);
let active = 0;
const waiters = [];

async function acquire() {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise((resolve) => waiters.push(resolve));
  active += 1;
}

function release() {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

export const pdfService = {
  /**
   * Render a certificate to a PDF Buffer.
   * @param {object} template  template row (design + page_size)
   * @param {object} data       merged variables
   * @param {string} qrDataUrl  QR PNG data URL
   */
  async renderCertificate({ template, data, qrDataUrl }) {
    const html = renderService.buildHtml({ template, data, qrDataUrl });
    const { w, h } = renderService.pageSizeMm(template.page_size);

    await acquire();
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      const pdf = await page.pdf({
        printBackground: true,
        width: `${w}mm`,
        height: `${h}mm`,
        pageRanges: '1',
      });
      return pdf;
    } finally {
      await page.close().catch(() => {});
      release();
    }
  },

  /** Graceful shutdown — close the shared browser. */
  async close() {
    if (browserPromise) {
      const b = await browserPromise.catch(() => null);
      if (b) await b.close().catch((e) => logger.warn({ err: e }, 'browser close failed'));
      browserPromise = null;
    }
  },
};
