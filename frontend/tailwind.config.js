/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Deep Forest Teal & Mint Design System Tokens
        forest: {
          50:  '#F2F7F5',
          100: '#E1EFEA',
          200: '#BCEBDD',
          300: '#8AE4C1',
          400: '#55C9A3',
          500: '#087B61',
          600: '#075443',
          700: '#163C32',
          800: '#192A26',
          900: '#101C1A',
          950: '#091210',
        },
        brand: {
          50:  '#F2F7F5',
          100: '#E1EFEA',
          200: '#BCEBDD',
          300: '#8AE4C1',
          400: '#55C9A3',
          500: '#087B61',
          600: '#075443',
          700: '#163C32',
          800: '#192A26',
          900: '#101C1A',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'glass-sm': '0 2px 8px 0 rgba(8, 123, 97, 0.04), 0 1px 2px 0 rgba(0, 0, 0, 0.02)',
        'glass-md': '0 8px 24px -4px rgba(8, 123, 97, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.04)',
        'glass-lg': '0 20px 40px -8px rgba(8, 123, 97, 0.12), 0 8px 16px -4px rgba(0, 0, 0, 0.06)',
        'glass-dark-sm': '0 2px 8px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(210, 245, 228, 0.06)',
        'glass-dark-md': '0 8px 24px -4px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(210, 245, 228, 0.08)',
        'glass-dark-lg': '0 20px 40px -8px rgba(0, 0, 0, 0.8), inset 0 1px 0 0 rgba(210, 245, 228, 0.1)',
      },
    },
  },
  plugins: [],
}
