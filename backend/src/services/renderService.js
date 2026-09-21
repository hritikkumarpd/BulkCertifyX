// Renders a certificate template + merged variables into a full HTML document.
// The SAME renderer drives on-screen preview and Puppeteer PDF output, so the
// downloaded certificate is pixel-identical to the preview.

const PAGE_SIZES = {
  'a4-landscape': { w: 297, h: 210 },
  'a4-portrait': { w: 210, h: 297 },
  'letter-landscape': { w: 279.4, h: 215.9 },
  'letter-portrait': { w: 215.9, h: 279.4 },
};

// Escape user/template text before injecting into HTML (XSS prevention).
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Replace {{variable}} tokens with values from `data`. Unknown tokens render empty.
function merge(text, data) {
  return String(text ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => esc(data[key] ?? ''));
}

function renderElement(el, data, qrDataUrl) {
  const pos = `position:absolute;left:${el.x}%;top:${el.y}%;` +
    (el.width != null ? `width:${el.width}%;` : '') +
    (el.rotation ? `transform:rotate(${el.rotation}deg);` : '');

  switch (el.type) {
    case 'text': {
      const style =
        `${pos}` +
        `font-family:${esc(el.fontFamily || 'Inter')},sans-serif;` +
        `font-size:${el.fontSize || 24}px;` +
        `font-weight:${el.fontWeight || 400};` +
        `color:${esc(el.color || '#111827')};` +
        `text-align:${el.align || 'center'};` +
        `line-height:${el.lineHeight || 1.3};` +
        `letter-spacing:${el.letterSpacing || 0}px;` +
        (el.italic ? 'font-style:italic;' : '') +
        `white-space:pre-wrap;`;
      return `<div style="${style}">${merge(el.text, data)}</div>`;
    }
    case 'image':
    case 'logo':
    case 'signature': {
      if (!el.src) return '';
      return `<img src="${esc(el.src)}" style="${pos}${el.height != null ? `height:${el.height}%;` : ''}object-fit:contain;" />`;
    }
    case 'qr': {
      return `<img src="${esc(qrDataUrl || '')}" style="${pos}${el.width ? '' : 'width:12%;'}aspect-ratio:1/1;object-fit:contain;" />`;
    }
    case 'line': {
      const style =
        `${pos}` +
        `border-top:${el.thickness || 2}px ${el.style || 'solid'} ${esc(el.color || '#111827')};`;
      return `<div style="${style}"></div>`;
    }
    default:
      return '';
  }
}

export const renderService = {
  PAGE_SIZES,

  /** Build a complete standalone HTML document for a certificate. */
  buildHtml({ template, data, qrDataUrl }) {
    const size = PAGE_SIZES[template.page_size] || PAGE_SIZES['a4-landscape'];
    const design = template.design || { background: '#ffffff', elements: [] };
    const bg = design.background || '#ffffff';
    const bgImage = design.backgroundImage
      ? `background-image:url('${esc(design.backgroundImage)}');background-size:cover;background-position:center;`
      : '';

    const elements = (design.elements || []).map((el) => renderElement(el, data, qrDataUrl)).join('\n');

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;600;700&family=Merriweather:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:${size.w}mm; height:${size.h}mm; }
  .page {
    position:relative;
    width:${size.w}mm;
    height:${size.h}mm;
    background:${esc(bg)};
    ${bgImage}
    overflow:hidden;
  }
  @page { size:${size.w}mm ${size.h}mm; margin:0; }
</style>
</head>
<body>
  <div class="page">
    ${elements}
  </div>
</body>
</html>`;
  },

  pageSizeMm(pageSize) {
    return PAGE_SIZES[pageSize] || PAGE_SIZES['a4-landscape'];
  },
};
