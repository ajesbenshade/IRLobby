/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#ff5c8a',
          deep: '#d93b70',
          warm: '#ffbf47',
          mint: '#2ecfb3',
          ink: '#241a35',
          muted: '#726884',
          line: '#eaddea',
          canvas: '#fff7fb',
          card: '#fffbff',
        },
      },
      borderRadius: {
        xl: '28px',
        '2xl': '36px',
      },
      boxShadow: {
        card: '0px 10px 22px rgba(143, 52, 101, 0.1)',
        float: '0px 16px 28px rgba(184, 56, 110, 0.22)',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
