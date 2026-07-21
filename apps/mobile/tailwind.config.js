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
          DEFAULT: '#5B4BFF',     // primary
          deep: '#C026D3',        // primaryDeep
          soft: '#D9D3F5',
          glow: '#7C6CFF',
          gold: '#E8C872',        // new premium accent
          goldSoft: '#FDF4D9',
          cyan: '#1EE8FF',
          cyanSoft: '#CFF9FF',
          ink: '#F4F3FA',
          muted: '#A5A1C2',
          line: '#2A2548',
          lineStrong: '#3D3659',
          surface: '#161330',
          surfaceMuted: '#110D24',
          canvas: '#0A0814',
          card: '#161330',
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
        float: '0px 12px 24px rgba(91, 75, 255, 0.22)',
        pop: '0px 6px 12px rgba(192, 38, 211, 0.28)',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
