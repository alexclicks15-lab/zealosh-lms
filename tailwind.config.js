/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f9f3',
          100: '#e8f3e7',
          200: '#cce5cb',
          300: '#9ecf9c',
          400: '#6fb76b',
          500: '#4E8C4A', // Official Primary Zealosh brand green
          600: '#3a7536', // Deep forest green
          700: '#2ea033', // Vibrant highlight green
          800: '#22591f',
          900: '#193f17',
          secondary: '#8CBF4D', // Official Secondary Green
          grey: '#ACACAC', // Official Grey
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#fbfdfb',
          muted: '#f4f9f3',
          card: '#ffffff',
          green: '#f1f8f0',
          border: '#e2efe1',
          glass: 'rgba(255, 255, 255, 0.85)',
        },
        // Neutral readable typography scale (slate)
        neutral: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#94a3b8',
          200: '#e2efe1',
          100: '#f1f8f0',
          50: '#fbfdfb',
        },
        // Fallback backward-compatibility alias for legacy code, safely redirected to neutral slate
        navy: {
          800: '#1e293b',
          900: '#0f172a',
          950: '#0f172a',
        },
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(79, 140, 76, 0.08)',
        'glass-sm': '0 4px 16px 0 rgba(79, 140, 76, 0.05)',
        'glass-green': '0 8px 32px 0 rgba(79, 140, 76, 0.12)',
        'neumorphic': '4px 4px 10px rgba(0, 0, 0, 0.04), -3px -3px 8px rgba(255, 255, 255, 0.9)',
        'neumorphic-btn': '3px 3px 6px rgba(58, 117, 54, 0.35), -2px -2px 5px rgba(255, 255, 255, 0.4)',
        'neumorphic-inset': 'inset 2px 2px 5px rgba(0, 0, 0, 0.04), inset -2px -2px 5px rgba(255, 255, 255, 0.9)',
      },
      backdropBlur: {
        'xs': '2px',
        'md': '12px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
