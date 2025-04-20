/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'media', // Use 'media' for prefers-color-scheme
    theme: {
      extend: {
        backgroundImage: {
          'light-thing': 'repeating-linear-gradient(-45deg, rgba(220, 220, 220, 0.2), rgba(220, 220, 220, 0.2) 6.5px, #ffffff 6.5px, #ffffff 32.5px)',
          'dark-thing': 'repeating-linear-gradient(-45deg, rgba(91, 91, 91, 0.2), rgba(91, 91, 91, 0.2) 6.5px, #ffffff 6.5px, #ffffff 32.5px)',
        },
        backgroundColor: {
          'light-thing-base': '#ffffff',
          'dark-thing-base': '#000000',
        },
      },
    },
    plugins: [],
  }