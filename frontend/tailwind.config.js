/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Light, restrained system. Indigo brand accent — not neon-purple.
        canvas: '#ffffff',
        surface: '#f8fafc',
        ink: '#111827',
        muted: '#64748b',
        line: '#e2e8f0',
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81',
        },
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2563eb',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        pop: '0 4px 12px rgba(16,24,40,0.08)',
      },
      maxWidth: { content: '1200px' },
    },
  },
  plugins: [],
};
