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
          DEFAULT: '#7C3AED',
          deep: '#EC4899',
          soft: '#F1E8FF',
          glow: '#A78BFA',
          warm: '#F59E0B',
          warmSoft: '#FEF3C7',
          cyan: '#22D3EE',
          cyanSoft: '#CFFAFE',
          ink: '#0F172A',
          muted: '#64748B',
          line: '#E2E8F0',
          lineStrong: '#CBD5E1',
          surface: '#FFFFFF',
          surfaceMuted: '#F8FAFC',
          canvas: '#F8FAFC',
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
        card: '0px 6px 16px rgba(15, 23, 42, 0.08)',
        float: '0px 12px 24px rgba(124, 58, 237, 0.18)',
        pop: '0px 6px 12px rgba(236, 72, 153, 0.24)',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
