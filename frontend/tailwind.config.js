/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 1.5s linear infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
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
        slate: { 850: '#172033' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        destructive: 'var(--destructive)',
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
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
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          400: '#FFBD33',
          500: '#FFAD00',
          600: '#E69C00',
          700: '#CC8A00',
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
          muted: 'var(--sidebar-muted)',
        },
        'brand-navy': 'var(--brand-navy)',
        'brand-blue': 'var(--brand-blue)',
        'brand-blue-light': 'var(--brand-blue-light)',
        'brand-blue-muted': 'var(--brand-blue-muted)',
        'brand-gray': 'var(--brand-gray)',
        'brand-yellow': 'var(--brand-yellow)',
        'brand-ink': 'var(--diagnostico-ink, #2e2d2c)',
        'brand-amber': 'var(--soaco-gold, #ffad00)',
        navy: {
          DEFAULT: 'var(--diagnostico-navy, #041e42)',
          soft: 'var(--diagnostico-navy-soft, #0a2a5c)',
        },
        page: 'var(--diagnostico-page, var(--background))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) * 0.8)',
        sm: 'calc(var(--radius) * 0.6)',
      },
      boxShadow: {
        'level-1': 'var(--shadow-1)',
        'level-2': 'var(--shadow-2)',
        'level-3': 'var(--shadow-3)',
        soaco: '0 6px 18px -6px rgb(4 30 66 / 0.16)',
        'soaco-lg': '0 14px 34px -10px rgb(4 30 66 / 0.24)',
        card: 'var(--diagnostico-shadow-card, 0 4px 24px rgb(4 30 66 / 0.06))',
        soft: 'var(--diagnostico-shadow-soft, 0 2px 12px rgb(46 45 44 / 0.06))',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
