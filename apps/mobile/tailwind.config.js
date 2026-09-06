/**
 * Tailwind config - values mirror apps/mobile/src/theme/tokens.ts.
 * If you change tokens.ts, change here too. (NativeWind preset can't import
 * a .ts file directly, so we keep these in sync manually.)
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF6B4A',
          deep: '#E25438',
          soft: '#FFE3DA',
          glow: '#FF8B70',
          gold: '#FF6B4A',
          goldSoft: '#FFE3DA',
          cyan: '#E25438',
          cyanSoft: '#FFD2C6',
          ink: '#1A1730',
          muted: '#5C5878',
          line: '#EDE4E0',
          lineStrong: '#D9CDC7',
          surface: '#FFFFFF',
          surfaceMuted: '#FFF0EA',
          canvas: '#FFF6F2',
          card: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Outfit_400Regular'],
        medium: ['Outfit_500Medium'],
        semibold: ['Outfit_600SemiBold'],
        bold: ['Outfit_700Bold'],
        display: ['Outfit_800ExtraBold'],
        serif: ['InstrumentSerif_400Regular'],
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '20px',
        xl: '28px',
        pill: '999px',
      },
      boxShadow: {
        card: '0px 6px 16px rgba(10, 8, 20, 0.2)',
        float: '0px 12px 24px rgba(255, 107, 74, 0.22)',
        pop: '0px 6px 12px rgba(192, 38, 211, 0.28)',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
