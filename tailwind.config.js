/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'gh-navy': '#4A6FA5',
        'gh-navy-dark': '#2C4A7C',
        'gh-yellow': '#F5E642',
      },
    },
  },
  plugins: [],
}

