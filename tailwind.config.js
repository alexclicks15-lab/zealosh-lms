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
          50: '#f1f8f0',
          100: '#e1f0df',
          200: '#c3e2be',
          300: '#99cd92',
          400: '#6eb365',
          500: '#4f8c4c', // Primary Zealosh brand green
          600: '#3a7536', // Deep forest green
          700: '#2ea033', // Vibrant highlight green
          800: '#245921',
          900: '#1a4118',
        },
        navy: {
          800: '#263238',
          900: '#252c41', // Dark header / text primary
          950: '#1a1f2e',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f4f5f7',
          card: '#f7f9fc',
          border: '#eaedf5',
        },
        accent: {
          orange: '#ff9b20',
          red: '#f33066',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
