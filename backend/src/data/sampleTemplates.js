// Five ready-to-use certificate designs. Positions are percentages of the page
// box; font sizes are px. Variable tokens ({{recipient_name}} etc.) are merged
// by renderService from certificate data. These feed both the seed script
// (src/scripts/seedTemplates.js) and the render self-check.

const uid = (p, i) => `${p}-${i}`;

export const sampleTemplates = [
  // 1 ─ Classic Achievement (landscape, cream, double-rule border feel) ──────
  {
    name: 'Classic Achievement',
    description: 'Timeless serif award certificate with a bordered layout.',
    page_size: 'a4-landscape',
    design: {
      background: '#fbf8f1',
      elements: [
        { id: uid('el', 1), type: 'line', x: 6, y: 8, width: 88, thickness: 3, color: '#b08d57' },
        { id: uid('el', 2), type: 'line', x: 6, y: 92, width: 88, thickness: 3, color: '#b08d57' },
        { id: uid('el', 3), type: 'text', x: 10, y: 14, width: 80, align: 'center', text: 'CERTIFICATE OF ACHIEVEMENT', fontFamily: 'Playfair Display', fontSize: 34, fontWeight: 700, color: '#1f2937', letterSpacing: 2 },
        { id: uid('el', 4), type: 'text', x: 10, y: 30, width: 80, align: 'center', text: 'This certificate is proudly presented to', fontFamily: 'Merriweather', fontSize: 15, color: '#6b7280' },
        { id: uid('el', 5), type: 'text', x: 10, y: 38, width: 80, align: 'center', text: '{{recipient_name}}', fontFamily: 'Playfair Display', fontSize: 52, fontWeight: 700, color: '#b08d57' },
        { id: uid('el', 6), type: 'line', x: 33, y: 55, width: 34, thickness: 1, color: '#d1c2a3' },
        { id: uid('el', 7), type: 'text', x: 15, y: 58, width: 70, align: 'center', text: 'for outstanding performance in {{event_name}}', fontFamily: 'Merriweather', fontSize: 16, color: '#374151', lineHeight: 1.5 },
        { id: uid('el', 8), type: 'text', x: 12, y: 82, width: 30, align: 'center', text: '{{issue_date}}', fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#374151' },
        { id: uid('el', 9), type: 'line', x: 12, y: 80, width: 30, thickness: 1, color: '#9ca3af' },
        { id: uid('el', 10), type: 'text', x: 12, y: 86, width: 30, align: 'center', text: 'Date', fontFamily: 'Inter', fontSize: 11, color: '#9ca3af' },
        { id: uid('el', 11), type: 'text', x: 58, y: 82, width: 30, align: 'center', text: '{{issued_by}}', fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#374151' },
        { id: uid('el', 12), type: 'line', x: 58, y: 80, width: 30, thickness: 1, color: '#9ca3af' },
        { id: uid('el', 13), type: 'text', x: 58, y: 86, width: 30, align: 'center', text: 'Authorized Signature', fontFamily: 'Inter', fontSize: 11, color: '#9ca3af' },
        { id: uid('el', 14), type: 'qr', x: 45, y: 74, width: 10 },
      ],
    },
  },

  // 2 ─ Modern Completion (landscape, indigo accent bar, clean sans) ─────────
  {
    name: 'Modern Completion',
    description: 'Minimal contemporary certificate of completion with an accent band.',
    page_size: 'a4-landscape',
    design: {
      background: '#ffffff',
      elements: [
        { id: uid('m', 1), type: 'line', x: 0, y: 0, width: 100, thickness: 14, color: '#4f46e5' },
        { id: uid('m', 2), type: 'text', x: 8, y: 16, width: 84, align: 'left', text: 'CERTIFICATE OF COMPLETION', fontFamily: 'Inter', fontSize: 22, fontWeight: 800, color: '#4f46e5', letterSpacing: 3 },
        { id: uid('m', 3), type: 'text', x: 8, y: 30, width: 84, align: 'left', text: 'Presented to', fontFamily: 'Inter', fontSize: 14, color: '#6b7280' },
        { id: uid('m', 4), type: 'text', x: 8, y: 36, width: 84, align: 'left', text: '{{recipient_name}}', fontFamily: 'Inter', fontSize: 46, fontWeight: 700, color: '#111827' },
        { id: uid('m', 5), type: 'text', x: 8, y: 52, width: 78, align: 'left', text: 'has successfully completed the course {{course_name}}, demonstrating dedication and mastery of the subject.', fontFamily: 'Inter', fontSize: 15, color: '#374151', lineHeight: 1.6 },
        { id: uid('m', 6), type: 'text', x: 8, y: 82, width: 40, align: 'left', text: 'Issued on {{issue_date}}', fontFamily: 'Inter', fontSize: 12, fontWeight: 500, color: '#6b7280' },
        { id: uid('m', 7), type: 'text', x: 8, y: 86, width: 40, align: 'left', text: '{{organization_name}}', fontFamily: 'Inter', fontSize: 12, fontWeight: 700, color: '#111827' },
        { id: uid('m', 8), type: 'qr', x: 82, y: 74, width: 12 },
      ],
    },
  },

  // 3 ─ Elegant Participation (portrait, soft gradient-ish, Playfair) ────────
  {
    name: 'Elegant Participation',
    description: 'Portrait participation certificate with a refined editorial feel.',
    page_size: 'a4-portrait',
    design: {
      background: '#f8fafc',
      elements: [
        { id: uid('p', 1), type: 'line', x: 8, y: 6, width: 84, thickness: 2, color: '#0f766e' },
        { id: uid('p', 2), type: 'text', x: 10, y: 12, width: 80, align: 'center', text: 'CERTIFICATE OF PARTICIPATION', fontFamily: 'Playfair Display', fontSize: 26, fontWeight: 700, color: '#0f766e', letterSpacing: 1 },
        { id: uid('p', 3), type: 'text', x: 10, y: 24, width: 80, align: 'center', text: 'This is to certify that', fontFamily: 'Merriweather', fontSize: 14, color: '#64748b' },
        { id: uid('p', 4), type: 'text', x: 8, y: 30, width: 84, align: 'center', text: '{{recipient_name}}', fontFamily: 'Playfair Display', fontSize: 40, fontWeight: 700, color: '#0f172a' },
        { id: uid('p', 5), type: 'text', x: 12, y: 42, width: 76, align: 'center', text: 'actively participated in {{event_name}} organized by {{organization_name}}.', fontFamily: 'Merriweather', fontSize: 15, color: '#334155', lineHeight: 1.6 },
        { id: uid('p', 6), type: 'qr', x: 44, y: 70, width: 12 },
        { id: uid('p', 7), type: 'text', x: 10, y: 84, width: 80, align: 'center', text: 'Verification: {{verification_code}}', fontFamily: 'Inter', fontSize: 11, color: '#94a3b8', letterSpacing: 1 },
        { id: uid('p', 8), type: 'text', x: 10, y: 88, width: 80, align: 'center', text: 'Issued {{issue_date}}', fontFamily: 'Inter', fontSize: 11, color: '#94a3b8' },
        { id: uid('p', 9), type: 'line', x: 8, y: 94, width: 84, thickness: 2, color: '#0f766e' },
      ],
    },
  },

  // 4 ─ Workshop Attendance (landscape, dark, gold — event vibe) ─────────────
  {
    name: 'Workshop Attendance',
    description: 'Bold dark certificate for workshops, bootcamps, and live events.',
    page_size: 'a4-landscape',
    design: {
      background: '#0f172a',
      elements: [
        { id: uid('w', 1), type: 'text', x: 10, y: 12, width: 80, align: 'center', text: 'CERTIFICATE OF ATTENDANCE', fontFamily: 'Inter', fontSize: 24, fontWeight: 800, color: '#fbbf24', letterSpacing: 4 },
        { id: uid('w', 2), type: 'line', x: 40, y: 24, width: 20, thickness: 2, color: '#fbbf24' },
        { id: uid('w', 3), type: 'text', x: 10, y: 30, width: 80, align: 'center', text: 'Awarded to', fontFamily: 'Inter', fontSize: 14, color: '#cbd5e1' },
        { id: uid('w', 4), type: 'text', x: 8, y: 37, width: 84, align: 'center', text: '{{recipient_name}}', fontFamily: 'Inter', fontSize: 48, fontWeight: 700, color: '#ffffff' },
        { id: uid('w', 5), type: 'text', x: 14, y: 54, width: 72, align: 'center', text: 'for attending {{event_name}} on {{issue_date}}', fontFamily: 'Inter', fontSize: 16, color: '#e2e8f0', lineHeight: 1.5 },
        { id: uid('w', 6), type: 'text', x: 10, y: 84, width: 55, align: 'left', text: '{{organization_name}}', fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#fbbf24' },
        { id: uid('w', 7), type: 'qr', x: 82, y: 72, width: 12 },
      ],
    },
  },

  // 5 ─ Professional Appreciation (landscape, white, teal, grade badge) ──────
  {
    name: 'Professional Appreciation',
    description: 'Corporate appreciation certificate with a grade/score line.',
    page_size: 'a4-landscape',
    design: {
      background: '#ffffff',
      elements: [
        { id: uid('a', 1), type: 'line', x: 5, y: 5, width: 90, thickness: 6, color: '#0d9488' },
        { id: uid('a', 2), type: 'line', x: 5, y: 95, width: 90, thickness: 6, color: '#0d9488' },
        { id: uid('a', 3), type: 'text', x: 10, y: 14, width: 80, align: 'center', text: 'CERTIFICATE OF APPRECIATION', fontFamily: 'Playfair Display', fontSize: 32, fontWeight: 700, color: '#0f172a' },
        { id: uid('a', 4), type: 'text', x: 10, y: 28, width: 80, align: 'center', text: 'In recognition of', fontFamily: 'Inter', fontSize: 14, color: '#64748b' },
        { id: uid('a', 5), type: 'text', x: 8, y: 34, width: 84, align: 'center', text: '{{recipient_name}}', fontFamily: 'Playfair Display', fontSize: 46, fontWeight: 700, color: '#0d9488' },
        { id: uid('a', 6), type: 'text', x: 15, y: 50, width: 70, align: 'center', text: 'for exceptional contribution to {{event_name}}', fontFamily: 'Inter', fontSize: 16, color: '#334155', lineHeight: 1.5 },
        { id: uid('a', 7), type: 'text', x: 30, y: 62, width: 40, align: 'center', text: 'Grade: {{grade}}', fontFamily: 'Inter', fontSize: 15, fontWeight: 700, color: '#0d9488', letterSpacing: 1 },
        { id: uid('a', 8), type: 'text', x: 12, y: 84, width: 30, align: 'center', text: '{{issue_date}}', fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: '#374151' },
        { id: uid('a', 9), type: 'line', x: 12, y: 82, width: 30, thickness: 1, color: '#9ca3af' },
        { id: uid('a', 10), type: 'text', x: 58, y: 84, width: 30, align: 'center', text: '{{issued_by}}', fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: '#374151' },
        { id: uid('a', 11), type: 'line', x: 58, y: 82, width: 30, thickness: 1, color: '#9ca3af' },
        { id: uid('a', 12), type: 'qr', x: 45, y: 70, width: 10 },
      ],
    },
  },
];
