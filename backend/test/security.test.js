import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractTemplateTokens, publicFieldsFor } from '../src/services/verificationService.js';
import { csvService, parseCsv } from '../src/services/csvService.js';
import { renderService } from '../src/services/renderService.js';
import { generateVerificationCode, generateApiKey, hashApiKey } from '../src/utils/codes.js';

// ── Verification: excessive-data-exposure / PII allowlist ──────────────────
test('verification exposes only template-rendered, non-PII fields', () => {
  const design = { elements: [{ type: 'text', text: 'Grade: {{grade}} in {{course_name}}' }] };
  const tokens = extractTemplateTokens(design);
  const fields = {
    grade: 'A+',
    course_name: 'Physics',
    recipient_email: 'a@b.com', // PII — never public
    salary: '900000',           // sensitive custom column, NOT on template
    national_id: 'X123',        // PII denylist
  };
  const pub = publicFieldsFor(fields, tokens);
  assert.deepEqual(pub, { grade: 'A+', course_name: 'Physics' });
  assert.equal(pub.recipient_email, undefined);
  assert.equal(pub.salary, undefined, 'un-rendered custom column must stay private');
  assert.equal(pub.national_id, undefined);
});

test('publicFieldsFor drops surfaced keys even when templated', () => {
  const tokens = new Set(['recipient_name', 'event_name', 'grade']);
  const pub = publicFieldsFor({ recipient_name: 'X', event_name: 'Y', grade: 'A' }, tokens);
  assert.deepEqual(pub, { grade: 'A' });
});

// ── CSV: prototype pollution, row/size caps, injection surface ─────────────
test('CSV parser ignores prototype-pollution header keys', () => {
  const csv = 'name,__proto__,constructor\nAlice,x,y';
  const { rows } = csvService.parse({ buffer: Buffer.from(csv), size: csv.length });
  assert.equal(rows[0].name, 'Alice');
  assert.ok(!Object.prototype.hasOwnProperty.call(rows[0], '__proto__'));
  assert.equal(({}).polluted, undefined);
});

test('CSV parser enforces a hard row cap', () => {
  const big = 'name\n' + Array.from({ length: 10001 }, (_, i) => `n${i}`).join('\n');
  assert.throws(() => csvService.parse({ buffer: Buffer.from(big), size: big.length }), /too many rows/);
});

test('CSV parser rejects oversize files', () => {
  const buffer = Buffer.alloc(6 * 1024 * 1024, 'a');
  assert.throws(() => csvService.parse({ buffer, size: buffer.length }), /5 MB/);
});

test('CSV parser handles quoted fields with commas and escaped quotes', () => {
  const matrix = parseCsv('a,b\n"x,y","he said ""hi"""');
  assert.deepEqual(matrix, [['a', 'b'], ['x,y', 'he said "hi"']]);
});

// ── Render: XSS escaping of recipient-controlled data & template text ──────
test('recipient data is HTML-escaped in rendered certificate', () => {
  const template = {
    page_size: 'a4-landscape',
    design: { background: '#fff', elements: [{ id: '1', type: 'text', x: 10, y: 10, text: 'Hi {{recipient_name}}' }] },
  };
  const html = renderService.buildHtml({
    template,
    data: { recipient_name: '<script>alert(1)</script>' },
    qrDataUrl: '',
  });
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw script tag must not appear');
  assert.ok(html.includes('&lt;script&gt;'), 'script must be escaped');
});

test('template text itself is HTML-escaped to prevent Stored XSS', () => {
  const template = {
    page_size: 'a4-landscape',
    design: { background: '#fff', elements: [{ id: '1', type: 'text', x: 10, y: 10, text: '<img src=x onerror=alert(2)> {{course}}' }] },
  };
  const html = renderService.buildHtml({
    template,
    data: { course: 'Math' },
    qrDataUrl: '',
  });
  assert.ok(!html.includes('<img src=x onerror=alert(2)>'), 'raw html in template text must not appear');
  assert.ok(html.includes('&lt;img src=x onerror=alert(2)&gt; Math'), 'template text must be escaped');
});

test('dangerous URI schemes in images and background are discarded', () => {
  const template = {
    page_size: 'a4-landscape',
    design: {
      background: '#fff',
      backgroundImage: 'javascript:alert(1)',
      elements: [
        { id: '1', type: 'image', x: 10, y: 10, src: 'file:///etc/passwd' },
        { id: '2', type: 'logo', x: 20, y: 20, src: 'javascript:void(0)' },
        { id: '3', type: 'image', x: 30, y: 30, src: 'https://example.com/logo.png' },
      ],
    },
  };
  const html = renderService.buildHtml({
    template,
    data: {},
    qrDataUrl: '',
  });
  assert.ok(!html.includes('javascript:alert(1)'), 'javascript background must be blocked');
  assert.ok(!html.includes('file:///etc/passwd'), 'file:/// image src must be blocked');
  assert.ok(!html.includes('javascript:void(0)'), 'javascript logo src must be blocked');
  assert.ok(html.includes('https://example.com/logo.png'), 'https image src must be allowed');
});

// ── Codes: format + API key hashing ────────────────────────────────────────
test('verification codes match the expected safe format', () => {
  const code = generateVerificationCode();
  assert.match(code, /^CERT-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
});

test('API key is high-entropy and stored only as a sha256 hash', () => {
  const { raw, prefix, hash } = generateApiKey();
  assert.ok(raw.startsWith('bcx_'));
  assert.equal(prefix, raw.slice(0, 12));
  assert.equal(hash, hashApiKey(raw));
  assert.notEqual(hash, raw, 'the raw key must never equal its stored hash');
  assert.equal(hash.length, 64);
});
