/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.{html,js}", "./templates/**/*.html"],
  darkMode: 'class',
  theme: {
      extend: {
          colors: {
              darkBg: '#1a1a24',
              darkPanel: '#22212c',
              brand: '#1a8fe3',
              brandButton: '#42CAFD',
              brandRed: '#FF595A',
              brandDark: '#22212C'
          },
          boxShadow: {
              'indie-light': '6px 6px 0px 0px rgba(34, 33, 44, 1)',
              'indie-dark': '6px 6px 0px 0px rgba(58, 165, 247, 0.3)',
              'indie-hover-light': '3px 3px 0px 0px rgba(34, 33, 44, 1)',
              'indie-hover-dark': '3px 3px 0px 0px rgba(58, 165, 247, 0.3)'
          }
      }
  },
  plugins: [],
}
