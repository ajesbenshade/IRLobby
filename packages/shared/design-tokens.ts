export const brandPalette = {
  // Electric Midnight — darker, richer, more premium
  primary: '#5B4BFF', // Rich indigo-violet
  primaryDeep: '#C026D3', // Electric fuchsia
  primarySoft: '#D9D3F5', // Soft desaturated violet
  primaryGlow: '#7C6CFF', // Lighter violet for glows

  secondary: '#1EE8FF', // Sharp electric cyan (matches, energy, live states)
  secondaryDeep: '#0EA5E9',
  secondarySoft: '#CFF9FF',

  accent: '#E8C872', // Warm gold — premium/VIP moments
  accentDeep: '#C5A04A',
  accentSoft: '#FDF4D9',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#F43F5E',

  // Dark-first neutrals (flagship canvas)
  ink: '#F4F3FA',
  mutedInk: '#A5A1C2',
  softInk: '#7A7599',

  line: '#2A2548',
  lineStrong: '#3D3659',

  surface: '#161330',
  surfaceMuted: '#110D24',
  background: '#0A0814',

  overlay: 'rgba(10, 8, 20, 0.78)',
  glass: 'rgba(255, 255, 255, 0.04)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',

  white: '#FFFFFF',
  black: '#000000',

  darkBackground: '#0A0814',
  darkSurface: '#110D24',
  darkSurfaceMuted: '#161330',
  darkLine: '#2A2548',
  darkInk: '#F4F3FA',
  darkMutedInk: '#A5A1C2',
  darkSoftInk: '#7A7599',

  // Soft light theme (not pure white)
  lightBackground: '#F7F6FB',
  lightSurface: '#FFFFFF',
  lightSurfaceMuted: '#F0EEF7',
  lightInk: '#1A1730',
  lightMutedInk: '#5C5878',
  lightSoftInk: '#8A86A8',
  lightLine: '#E4E0F0',
  lightLineStrong: '#D0CBE3',
  lightOverlay: 'rgba(26, 23, 48, 0.48)',
} as const;

export const brandGradients = {
  primary: [brandPalette.primary, brandPalette.primaryDeep],
  match: [brandPalette.primary, brandPalette.primaryDeep, brandPalette.secondary],
  premium: [brandPalette.primaryDeep, brandPalette.accent],
  surfaceGlow: [brandPalette.primarySoft, brandPalette.secondarySoft, brandPalette.accentSoft],
} as const;

export const brandRadii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const brandSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const brandTypography = {
  bodyRegular: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodySemibold: 'Outfit_600SemiBold',
  heading: 'Outfit_700Bold',
  headingDisplay: 'Outfit_800ExtraBold',
  display: 'Outfit_800ExtraBold',
} as const;

export const brandFontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  display: 48,
} as const;

export const brandLineHeight = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
} as const;

export const brandMotion = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

/** Blur radii (px) for glass / frosted chrome */
export const brandBlur = {
  sm: 8,
  md: 16,
  lg: 22,
  xl: 32,
} as const;

/** Elevation / shadow recipes (web CSS + RN shadow props) */
export const brandElevation = {
  card: {
    shadowColor: brandPalette.black,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    css: '0 8px 24px rgba(0, 0, 0, 0.18)',
  },
  float: {
    shadowColor: brandPalette.primary,
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
    css: '0 14px 40px rgba(91, 75, 255, 0.22)',
  },
  pop: {
    shadowColor: brandPalette.primaryDeep,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    css: '0 6px 18px rgba(192, 38, 211, 0.28)',
  },
  soft: {
    shadowColor: brandPalette.black,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    css: '0 4px 16px rgba(0, 0, 0, 0.08)',
  },
} as const;

export const brand = {
  name: 'The Foyer',
  tagline: 'Gatherings for Franconia Mennonite Church',
} as const;
