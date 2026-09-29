import {
  brand as sharedBrand,
  brandBlur,
  brandElevation,
  brandFontSize,
  brandLineHeight,
  brandMotion,
  brandPalette,
  brandRadii,
  brandSpacing,
  brandTypography,
} from '@shared/design-tokens';

/**
 * IRLobby mobile design tokens.
 * Tagline: "Get out. Get together."
 *
 * Coral + white sheets — locked to Design frames A–D.
 * Shared Electric Midnight tokens stay the web source of truth.
 */

const burgundy = {
  primary: '#a2033f',
  primaryDeep: '#7c0230',
  primarySoft: '#f3d5e0',
  primaryGlow: '#c43b68',
} as const;

export const palette = {
  primary: burgundy.primary,
  primaryDeep: burgundy.primaryDeep,
  primarySoft: burgundy.primarySoft,
  primaryGlow: burgundy.primaryGlow,

  secondary: burgundy.primaryDeep,
  secondaryDeep: '#5c0224',
  secondarySoft: '#f8e4eb',

  accent: burgundy.primary,
  accentDeep: burgundy.primaryDeep,
  accentSoft: burgundy.primarySoft,

  success: brandPalette.success,
  warning: brandPalette.warning,
  danger: brandPalette.danger,

  ink: '#222222',
  mutedInk: '#5c534f',
  softInk: '#8a7f7a',
  line: '#eadfd9',
  lineStrong: '#d9cdc7',
  surface: '#ffffff',
  surfaceMuted: '#f6f1ee',
  background: '#f6f1ee',
  overlay: 'rgba(28, 21, 32, 0.48)',
  glass: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(255, 107, 74, 0.16)',
  white: brandPalette.white,
  black: brandPalette.black,

  darkBackground: '#1A1412',
  darkSurface: '#2A2320',
  darkSurfaceMuted: '#3A312D',
  darkLine: '#4A403B',
  darkInk: '#FFF6F2',
  darkMutedInk: '#C4B6B0',
  darkSoftInk: '#8E827C',

  lightBackground: '#f6f1ee',
  lightSurface: '#ffffff',
  lightSurfaceMuted: '#f6f1ee',
  lightInk: '#222222',
  lightMutedInk: brandPalette.lightMutedInk,
  lightSoftInk: brandPalette.lightSoftInk,
  lightLine: '#EDE4E0',
  lightLineStrong: '#D9CDC7',
  lightOverlay: 'rgba(28, 21, 32, 0.48)',
} as const;

export const radii = {
  xs: brandRadii.xs,
  sm: brandRadii.sm,
  md: brandRadii.md,
  lg: brandRadii.lg,
  xl: brandRadii.xl,
  pill: brandRadii.pill,
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
  bodyRegular: brandTypography.bodyRegular,
  bodyMedium: brandTypography.bodyMedium,
  bodySemibold: brandTypography.bodySemibold,
  heading: 'Georgia',
  headingDisplay: 'Georgia',
  display: 'Georgia',
} as const;

export const fontSize = {
  xs: brandFontSize.xs,
  sm: brandFontSize.sm,
  base: brandFontSize.base,
  lg: brandFontSize.lg,
  xl: brandFontSize.xl,
  xxl: brandFontSize.xxl,
  display: brandFontSize.display,
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
    shadowColor: burgundy.primary,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: brandElevation.float.shadowOffset,
    elevation: brandElevation.float.elevation,
  },
  pop: {
    shadowColor: burgundy.primaryDeep,
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
  name: sharedBrand.name,
  tagline: sharedBrand.tagline,
} as const;

/** Login canvas — matches Design dressed frame (Apple + Google + email). */
export const loginGradients = {
  dressed: ['#FFF8F4', '#FFE4DA', '#FFD4C6'] as const,
  twitterProgress: ['#FF8B70', '#FF6B4A', '#E25438'] as const,
} as const;
