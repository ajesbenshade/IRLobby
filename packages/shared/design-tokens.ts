export const brandPalette = {
  primary: '#7C3AED',
  primaryDeep: '#EC4899',
  primarySoft: '#F1E8FF',
  primaryGlow: '#A78BFA',
  secondary: '#22D3EE',
  secondaryDeep: '#0891B2',
  secondarySoft: '#CFFAFE',
  accent: '#A78BFA',
  accentDeep: '#6D28D9',
  accentSoft: '#EDE9FE',
  success: '#84CC16',
  warning: '#F59E0B',
  danger: '#F43F5E',
  ink: '#0F172A',
  mutedInk: '#64748B',
  softInk: '#94A3B8',
  line: '#E2E8F0',
  lineStrong: '#CBD5E1',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFC',
  background: '#F8FAFC',
  overlay: 'rgba(15,23,42,0.55)',
  white: '#FFFFFF',
  black: '#000000',
  darkBackground: '#0F172A',
  darkSurface: '#111827',
  darkSurfaceMuted: '#1E293B',
  darkLine: '#334155',
  darkInk: '#F8FAFC',
  darkMutedInk: '#CBD5E1',
  darkSoftInk: '#94A3B8',
} as const;

export const brandGradients = {
  primary: [brandPalette.primary, brandPalette.primaryDeep],
  match: [brandPalette.primary, brandPalette.primaryDeep, brandPalette.secondary],
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
