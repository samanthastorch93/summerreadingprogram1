/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          yellow: '#FFC400',
          red: '#E30D00',
          blue: '#0F00E3',
          pink: '#FFE3E3',
          sky: '#E3FAFF',
        },
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'scale-in': 'scale-in 0.1s ease-out',
      },
    },
  },
  plugins: [],
};
