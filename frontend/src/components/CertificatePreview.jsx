// A tasteful sample certificate rendered as inline SVG for marketing/verify pages.
// (The real certificates are Puppeteer-rendered PDFs from the template engine.)
export default function CertificatePreview({
  recipient = 'Hritik Kumar',
  course = 'Full Stack Development',
  org = 'BulkCertifyX',
  code = 'CERT-A7K2-X9PQ',
}) {
  return (
    <svg viewBox="0 0 600 420" className="h-auto w-full rounded-lg" role="img" aria-label="Certificate preview">
      <rect width="600" height="420" fill="#ffffff" />
      <rect x="16" y="16" width="568" height="388" fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="24" y="24" width="552" height="372" fill="none" stroke="#4f46e5" strokeWidth="1" opacity="0.35" />

      <text x="300" y="78" textAnchor="middle" fontFamily="Inter" fontSize="13" letterSpacing="3" fill="#4f46e5" fontWeight="600">CERTIFICATE OF COMPLETION</text>
      <line x1="250" y1="94" x2="350" y2="94" stroke="#4f46e5" strokeWidth="2" />

      <text x="300" y="140" textAnchor="middle" fontFamily="Inter" fontSize="13" fill="#64748b">This is proudly presented to</text>
      <text x="300" y="185" textAnchor="middle" fontFamily="Playfair Display, serif" fontSize="40" fill="#111827" fontWeight="700">{recipient}</text>

      <text x="300" y="222" textAnchor="middle" fontFamily="Inter" fontSize="13" fill="#64748b">for successfully completing</text>
      <text x="300" y="250" textAnchor="middle" fontFamily="Inter" fontSize="20" fill="#111827" fontWeight="600">{course}</text>

      <text x="120" y="340" textAnchor="middle" fontFamily="Inter" fontSize="12" fill="#111827" fontWeight="600">{org}</text>
      <line x1="60" y1="322" x2="180" y2="322" stroke="#cbd5e1" strokeWidth="1" />
      <text x="120" y="356" textAnchor="middle" fontFamily="Inter" fontSize="10" fill="#94a3b8">Issued by</text>

      {/* QR placeholder block */}
      <g transform="translate(456,300)">
        <rect width="72" height="72" fill="#111827" rx="4" />
        <g fill="#ffffff">
          <rect x="8" y="8" width="18" height="18" /><rect x="46" y="8" width="18" height="18" />
          <rect x="8" y="46" width="18" height="18" /><rect x="34" y="34" width="8" height="8" />
          <rect x="50" y="46" width="8" height="8" /><rect x="46" y="58" width="8" height="8" />
        </g>
      </g>
      <text x="492" y="388" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#64748b">{code}</text>
    </svg>
  );
}
