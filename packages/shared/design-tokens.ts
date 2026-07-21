export const brandPalette = {
  // Electric Midnight — darker, richer, more premium
  primary: '#5B4BFF',        // Rich indigo-violet
  primaryDeep: '#C026D3',    // Electric fuchsia
  primarySoft: '#D9D3F5',    // Soft desaturated violet
  primaryGlow: '#7C6CFF',    // Lighter violet for glows

  secondary: '#1EE8FF',      // Sharp electric cyan (matches, energy, live states)
  secondaryDeep: '#0EA5E9',
  secondarySoft: '#CFF9FF',

  accent: '#E8C872',         // Warm gold — premium/VIP moments
  accentDeep: '#C5A04A',
  accentSoft: '#FDF4D9',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#F43F5E',

  ink: '#F4F3FA',
  mutedInk: '#A5A1C2',
  softInk: '#7A7599',

  line: '#2A2548',
  lineStrong: '#3D3659',

  surface: '#161330',
  surfaceMuted: '#110D24',
  background: '#0A0814',

  overlay: 'rgba(10, 8, 20, 0.78)',

  white: '#FFFFFF',
  black: '#000000',

  darkBackground: '#0A0814',
  darkSurface: '#110D24',
  darkSurfaceMuted: '#161330',
  darkLine: '#2A2548',
  darkInk: '#F4F3FA',
  darkMutedInk: '#A5A1C2',
  darkSoftInk: '#7A7599',
} as const;

export const brandGradients = {
  primary: [brandPalette.primary, brandPalette.primaryDeep],
  match: [brandPalette.primary, brandPalette.primaryDeep, brandPalette.secondary],
  premium: [brandPalette.primaryDeep, brandPalette.accent], // Gold-tinged high-end moments
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

export const brand = {
  name: 'IRLobby',
  tagline: 'Get out. Get together.',
} as const;
