import {
  brand as sharedBrand,
  brandBlur,
  brandElevation,
  brandFontSize,
  brandLineHeight,
  brandMotion,
  brandPalette,
  brandSpacing,
} from '@shared/design-tokens';

/**
 * The Foyer mobile design tokens.
 * Franconia Mennonite Church — burgundy on cream.
 */

const foyer = {
  burgundy: '#a2033f',
  burgundyDeep: '#7c0230',
  burgundyGlow: '#c43a66',
  burgundyTint: '#f9e8ee',
  ink: '#222222',
  paper: '#ffffff',
  cream: '#f6f1ee',
  textSecondary: '#6e6a68',
  textMuted: '#a09b98',
  border: '#e1dbd7',
  warnBg: '#fdf3e6',
  warnText: '#8a540a',
} as const;

export const palette = {
  primary: foyer.burgundy,
  primaryDeep: foyer.burgundyDeep,
  primarySoft: foyer.burgundyTint,
  primaryGlow: foyer.burgundyGlow,

  secondary: foyer.burgundyDeep,
  secondaryDeep: '#5c0124',
  secondarySoft: foyer.burgundyTint,

  accent: foyer.burgundy,
  accentDeep: foyer.burgundyDeep,
  accentSoft: foyer.burgundyTint,

  success: brandPalette.success,
  warning: foyer.warnText,
  warnBg: foyer.warnBg,
  warnText: foyer.warnText,
  danger: brandPalette.danger,

  ink: foyer.ink,
  mutedInk: foyer.textSecondary,
  softInk: foyer.textMuted,
  line: foyer.border,
  lineStrong: '#d3ccc7',
  surface: foyer.paper,
  surfaceMuted: foyer.burgundyTint,
  background: foyer.cream,
  overlay: 'rgba(34, 34, 34, 0.48)',
  glass: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(162, 3, 63, 0.16)',
  white: foyer.paper,
  black: brandPalette.black,

  darkBackground: '#1a1214',
  darkSurface: '#2a1c20',
  darkSurfaceMuted: '#3a282c',
  darkLine: '#4a383c',
  darkInk: foyer.cream,
  darkMutedInk: '#c4b6b0',
  darkSoftInk: '#8e827c',

  lightBackground: foyer.cream,
  lightSurface: foyer.paper,
  lightSurfaceMuted: foyer.burgundyTint,
  lightInk: foyer.ink,
  lightMutedInk: foyer.textSecondary,
  lightSoftInk: foyer.textMuted,
  lightLine: foyer.border,
  lightLineStrong: '#d3ccc7',
  lightOverlay: 'rgba(34, 34, 34, 0.48)',
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 22,
  card: 22,
  list: 16,
  input: 12,
  pill: 999,
} as const;

export const spacing = {
  xxs: brandSpacing.xxs,
  xs: brandSpacing.xs,
  sm: brandSpacing.sm,
  md: brandSpacing.md,
  lg: brandSpacing.lg,
  xl: brandSpacing.xl,
  xxl: brandSpacing.xxl,
  xxxl: brandSpacing.xxxl,
} as const;

export const typography = {
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  heading: 'LibreBaskerville_700Bold',
  headingDisplay: 'LibreBaskerville_700Bold',
  display: 'LibreBaskerville_700Bold',
} as const;

export const fontSize = {
  xs: brandFontSize.xs,
  sm: brandFontSize.sm,
  base: brandFontSize.base,
  lg: brandFontSize.lg,
  xl: brandFontSize.xl,
  xxl: brandFontSize.xxl,
  display: brandFontSize.display,
  wordmark: 26,
  screenTitle: 28,
  cardTitle: 25,
} as const;

export const lineHeight = {
  tight: brandLineHeight.tight,
  snug: brandLineHeight.snug,
  normal: brandLineHeight.normal,
} as const;

export const shadows = {
  card: {
    shadowColor: brandElevation.card.shadowColor,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: brandElevation.card.shadowOffset,
    elevation: brandElevation.card.elevation,
  },
  float: {
    shadowColor: foyer.burgundy,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: brandElevation.float.shadowOffset,
    elevation: brandElevation.float.elevation,
  },
  pop: {
    shadowColor: foyer.burgundyDeep,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: brandElevation.pop.shadowOffset,
    elevation: brandElevation.pop.elevation,
  },
  soft: {
    shadowColor: brandElevation.soft.shadowColor,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: brandElevation.soft.shadowOffset,
    elevation: brandElevation.soft.elevation,
  },
} as const;

export const blur = {
  sm: brandBlur.sm,
  md: brandBlur.md,
  lg: brandBlur.lg,
  xl: brandBlur.xl,
} as const;

export const motion = {
  fast: brandMotion.fast,
  base: brandMotion.base,
  slow: brandMotion.slow,
} as const;

export const brand = {
  name: 'The Foyer',
  church: 'Franconia Mennonite Church',
  tagline: sharedBrand.tagline,
} as const;

/** Login canvas — cream paper with a burgundy wash. */
export const loginGradients = {
  dressed: ['#ffffff', '#f6f1ee', '#f9e8ee'] as const,
  twitterProgress: ['#c43a66', '#a2033f', '#7c0230'] as const,
} as const;
