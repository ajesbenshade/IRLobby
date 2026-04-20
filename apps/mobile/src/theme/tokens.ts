/**
 * IRLobby design tokens — single source of truth.
 * Tagline: "Get out. Get together."
 *
 * Both the React Native theme (theme/index.ts) and Tailwind
 * (tailwind.config.js) consume this file. Do not hard-code colors,
 * radii, or shadows elsewhere.
 */

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

export const palette = {
  // Brand — electric magenta
  primary: '#FF2E63',
  primaryDeep: '#D6004F',
  primarySoft: '#FFE0EA',
  primaryGlow: '#FF6F95',

  // Secondary — confident sun-yellow
  secondary: '#FCD34D',
  secondaryDeep: '#E0A800',
  secondarySoft: '#FFF4C2',

  // Accent — electric cyan
  accent: '#22D3EE',
  accentDeep: '#0E9FB8',
  accentSoft: '#CFF7FE',

  // Status
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',

  // Neutrals (light)
  ink: '#0B0B14',
  mutedInk: '#5B5B6B',
  softInk: '#9A9AA8',
  line: '#ECECF1',
  lineStrong: '#DCDCE5',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F2F7',
  background: '#F7F7FA',
  overlay: 'rgba(11,11,20,0.55)',
  white: '#FFFFFF',
  black: '#000000',

  // Neutrals (dark)
  darkBackground: '#0B0B14',
  darkSurface: '#15151F',
  darkSurfaceMuted: '#1E1E2B',
  darkLine: '#2A2A3A',
  darkInk: '#F7F7FA',
  darkMutedInk: '#A8A8B8',
  darkSoftInk: '#6E6E80',
} as const;

// ---------------------------------------------------------------------------
// Radii — tighter, more modern
// ---------------------------------------------------------------------------

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Spacing — 4px base
// ---------------------------------------------------------------------------

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// ---------------------------------------------------------------------------
// Type scale
// ---------------------------------------------------------------------------

export const typography = {
  // Sans (body + UI)
  bodyRegular: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodySemibold: 'Outfit_600SemiBold',
  heading: 'Outfit_700Bold',
  headingDisplay: 'Outfit_800ExtraBold',
  // Display (used sparingly for hero moments). Currently aliased to
  // Outfit ExtraBold; swap to a serif (e.g. Instrument Serif, Fraunces)
  // once the font package is added to apps/mobile/package.json.
  display: 'Outfit_800ExtraBold',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  display: 48,
} as const;

export const lineHeight = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
} as const;

// ---------------------------------------------------------------------------
// Shadows — neutral, no pink tint
// ---------------------------------------------------------------------------

export const shadows = {
  // Subtle — for content cards and inputs
  card: {
    shadowColor: '#0B0B14',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  // Stronger — for floating CTAs, tab bar, modals
  float: {
    shadowColor: '#0B0B14',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  // Tight, sharp — for raised buttons (FAB)
  pop: {
    shadowColor: '#0B0B14',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

// ---------------------------------------------------------------------------
// Motion — animation durations (ms)
// ---------------------------------------------------------------------------

export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

export const brand = {
  name: 'IRLobby',
  tagline: 'Get out. Get together.',
} as const;
