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
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.isConnected()) {
      return b;
    }
    browserPromise = null;
  }

  browserPromise = puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  }).then((browser) => {
    browser.on('disconnected', () => {
      logger.warn('Puppeteer browser disconnected. Clearing cached instance.');
      browserPromise = null;
    });
    return browser;
  }).catch((err) => {
    browserPromise = null;
    throw err;
  });

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
  // Wait for a slot. release() hands the slot directly to us (it does NOT
  // decrement `active`), so we must NOT increment again on resume — otherwise
  // a concurrent acquire() could slip in during the wake microtask and push
  // `active` above MAX_CONCURRENT.
  await new Promise((resolve) => waiters.push(resolve));
}

function release() {
  const next = waiters.shift();
  if (next) {
    // Hand the slot to the next waiter without touching `active`.
    next();
  } else {
    active = Math.max(0, active - 1);
  }
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
    let page = null;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();

      // Security: Prevent SSRF and local file leakage in headless browser
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url().toLowerCase();
        try {
          if (
            url.startsWith('file:') ||
            url.includes('169.254.169.254') ||
            url.includes('127.0.0.1') ||
            url.includes('localhost')
          ) {
            req.abort();
          } else {
            req.continue();
          }
        } catch {
          // Request may already be handled under a race; ignore so the render
          // promise isn't rejected by a duplicate abort/continue.
        }
      });

      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      const pdf = await page.pdf({
        printBackground: true,
        width: `${w}mm`,
        height: `${h}mm`,
        pageRanges: '1',
        timeout: 30000,
      });
      return pdf;
    } finally {
      if (page) await page.close().catch(() => {});
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
