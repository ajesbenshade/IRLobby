/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5b61f6',
          deep: '#4338ca',
          warm: '#f6b94a',
          mint: '#20b77d',
          ink: '#121826',
          muted: '#667085',
          line: '#dde3f0',
          canvas: '#f4f7fb',
          card: '#ffffff',
        },
      },
      borderRadius: {
        xl: '24px',
        '2xl': '32px',
      },
      boxShadow: {
        card: '0px 8px 18px rgba(35, 48, 77, 0.09)',
        float: '0px 14px 24px rgba(29, 78, 216, 0.18)',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
