/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:  '#0A0A0A',
        accent:   '#2563EB',
        success:  '#16A34A',
        warning:  '#D97706',
        danger:   '#DC2626',
        muted:    '#6B7280',
        border:   '#E5E7EB',
        card:     '#FFFFFF',
        page:     '#F9FAFB',
        sidebar:  '#0F172A',
        'sidebar-text':   '#94A3B8',
        'sidebar-active': '#FFFFFF',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}
