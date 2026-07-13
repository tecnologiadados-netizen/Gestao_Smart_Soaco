/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#041E42', soft: '#0a2a5c' },
        brand: { blue: '#1E22AA', amber: '#FFAD00', gray: '#808080', ink: '#2E2D2C' },
        page: '#F4F6F9',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(4, 30, 66, 0.06)',
        soft: '0 2px 12px rgba(46, 45, 44, 0.06)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
