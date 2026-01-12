/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"DM Sans"', 'sans-serif'],
        serif: ['"Cormorant Garamond"', '"Playfair Display"', 'serif'],
      },
      colors: {
        'offwhite': '#FAFAF7',
        'offwhite-dark': '#F8F8F5',
      }
    },
  },
  plugins: [],
}
