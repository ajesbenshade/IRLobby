/**
 * Tailwind config — values mirror apps/mobile/src/theme/tokens.ts.
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
          DEFAULT: '#FF2E63',
          deep: '#D6004F',
          soft: '#FFE0EA',
          glow: '#FF6F95',
          warm: '#FCD34D',
          warmSoft: '#FFF4C2',
          cyan: '#22D3EE',
          cyanSoft: '#CFF7FE',
          ink: '#0B0B14',
          muted: '#5B5B6B',
          line: '#ECECF1',
          lineStrong: '#DCDCE5',
          surface: '#FFFFFF',
          surfaceMuted: '#F2F2F7',
          canvas: '#F7F7FA',
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
        card: '0px 6px 16px rgba(11, 11, 20, 0.08)',
        float: '0px 12px 24px rgba(11, 11, 20, 0.16)',
        pop: '0px 6px 12px rgba(11, 11, 20, 0.22)',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};
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
