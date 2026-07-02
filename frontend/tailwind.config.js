/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 1.5s linear infinite',
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['15px', { lineHeight: '1.5' }],
      },
      colors: {
        soaco: {
          navy: '#041E42',
          blue: '#1E22AA',
          gold: '#FFAD00',
          gray: '#808080',
          graphite: '#2E2D2C',
          white: '#FFFFFF',
        },
        primary: {
          50: '#E8EAF9',
          100: '#C5CAF2',
          200: '#9BA3E8',
          300: '#717CDF',
          400: '#4A57D6',
          500: '#2A38CC',
          600: '#1E22AA',
          700: '#161A88',
          800: '#0F1266',
          900: '#041E42',
        },
        accent: {
          400: '#FFBD33',
          500: '#FFAD00',
          600: '#E69C00',
          700: '#CC8A00',
        },
        slate: { 850: '#172033' },
      },
      boxShadow: {
        soaco: '0 4px 14px rgb(4 30 66 / 0.12)',
        'soaco-lg': '0 8px 24px rgb(4 30 66 / 0.18)',
      },
    },
  },
  plugins: [],
};
