
module.exports = {
  content: ["./src*.{html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        fadeInOnce: {
          '0%': { opacity: '0', transform: 'scale(0.98)', filter: 'blur(10px)' },
          '100%': { opacity: '1', transform: 'scale(1)', filter: 'blur(0px)' },
        },
      },
      animation: {
        fadeInOnce: 'fadeInOnce 1s ease-out forwards',
      },
    },
  },
  plugins: [],
}
