import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary brand — Emerald green
        brand: {
  50:  '#e6f4ef',
  100: '#c0e4d6',
  200: '#88ceac',
  300: '#4fb083',
  400: '#1f936d',
  500: '#00875e',  // primary
  600: '#006e4d',
  700: '#00563b',
  800: '#003e2a',
  900: '#002a1c',
  950: '#001a11',
},
        // Navy — deep slate (used by landing components)
        navy: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
          800: '#1e293b', 900: '#0f172a', 950: '#020617',
        },
        // Ink — alias for navy (used by topology preview)
        ink: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
          800: '#1e293b', 900: '#0f172a', 950: '#020617',
        },
        // Accent — emerald alias (used by topology preview)
        accent: {
  50:  '#e6f4ef',
  100: '#c0e4d6',
  200: '#88ceac',
  300: '#4fb083',
  400: '#1f936d',
  500: '#00875e',
  600: '#006e4d',
  700: '#00563b',
  800: '#003e2a',
  900: '#002a1c',
  950: '#001a11',
},
        // Cream — warm off-white (used by LandingPage root)
        cream: {
          50: '#0f172a',  // mapped to dark navy (landing is dark mode)
          100: '#1e293b',
        },
        // Semantic colors (used by some components)
        danger: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f',
        },
        success: {
  50:  '#e6f4ef',
  100: '#c0e4d6',
  200: '#88ceac',
  300: '#4fb083',
  400: '#1f936d',
  500: '#00875e',
  600: '#006e4d',
  700: '#00563b',
  800: '#003e2a',
  900: '#002a1c',
},
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0,0,0,0.12)',
        'soft-lg': '0 8px 24px rgba(0,0,0,0.18)',
        'glow-brand': '0 0 20px rgba(16,185,129,0.25)',
      },
      backgroundImage: {
        'grid-dark': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='%2334d399' stroke-opacity='0.05' stroke-width='1'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'fade-in-down': 'fadeInDown 0.6s ease-out',
        'pulse-emerald': 'pulseEmerald 1.2s ease-in-out infinite',
        'blink': 'blink 1s steps(2, start) infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        fadeInUp: { '0%': { opacity: 0, transform: 'translateY(16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        fadeInDown: { '0%': { opacity: 0, transform: 'translateY(-16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulseEmerald: {
          '0%, 100%': { opacity: 1, transform: 'scaleY(1)' },
          '50%': { opacity: 0.4, transform: 'scaleY(0.85)' },
        },
        blink: { to: { visibility: 'hidden' } },
      },
    },
  },
  plugins: [typography],
};
