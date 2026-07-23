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
 * Electric Midnight — shared source: packages/shared/design-tokens.ts
 */

export const palette = {
  primary: brandPalette.primary,
  primaryDeep: brandPalette.primaryDeep,
  primarySoft: brandPalette.primarySoft,
  primaryGlow: brandPalette.primaryGlow,

  secondary: brandPalette.secondary,
  secondaryDeep: brandPalette.secondaryDeep,
  secondarySoft: brandPalette.secondarySoft,

  accent: brandPalette.accent,
  accentDeep: brandPalette.accentDeep,
  accentSoft: brandPalette.accentSoft,

  success: brandPalette.success,
  warning: brandPalette.warning,
  danger: brandPalette.danger,

  ink: brandPalette.ink,
  mutedInk: brandPalette.mutedInk,
  softInk: brandPalette.softInk,
  line: brandPalette.line,
  lineStrong: brandPalette.lineStrong,
  surface: brandPalette.surface,
  surfaceMuted: brandPalette.surfaceMuted,
  background: brandPalette.background,
  overlay: brandPalette.overlay,
  glass: brandPalette.glass,
  glassBorder: brandPalette.glassBorder,
  white: brandPalette.white,
  black: brandPalette.black,

  darkBackground: brandPalette.darkBackground,
  darkSurface: brandPalette.darkSurface,
  darkSurfaceMuted: brandPalette.darkSurfaceMuted,
  darkLine: brandPalette.darkLine,
  darkInk: brandPalette.darkInk,
  darkMutedInk: brandPalette.darkMutedInk,
  darkSoftInk: brandPalette.darkSoftInk,

  lightBackground: brandPalette.lightBackground,
  lightSurface: brandPalette.lightSurface,
  lightSurfaceMuted: brandPalette.lightSurfaceMuted,
  lightInk: brandPalette.lightInk,
  lightMutedInk: brandPalette.lightMutedInk,
  lightSoftInk: brandPalette.lightSoftInk,
  lightLine: brandPalette.lightLine,
  lightLineStrong: brandPalette.lightLineStrong,
  lightOverlay: brandPalette.lightOverlay,
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
  heading: brandTypography.heading,
  headingDisplay: brandTypography.headingDisplay,
  display: brandTypography.display,
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
    shadowOpacity: brandElevation.card.shadowOpacity,
    shadowRadius: brandElevation.card.shadowRadius,
    shadowOffset: brandElevation.card.shadowOffset,
    elevation: brandElevation.card.elevation,
  },
  float: {
    shadowColor: brandElevation.float.shadowColor,
    shadowOpacity: brandElevation.float.shadowOpacity,
    shadowRadius: brandElevation.float.shadowRadius,
    shadowOffset: brandElevation.float.shadowOffset,
    elevation: brandElevation.float.elevation,
  },
  pop: {
    shadowColor: brandElevation.pop.shadowColor,
    shadowOpacity: brandElevation.pop.shadowOpacity,
    shadowRadius: brandElevation.pop.shadowRadius,
    shadowOffset: brandElevation.pop.shadowOffset,
    elevation: brandElevation.pop.elevation,
  },
  soft: {
    shadowColor: brandElevation.soft.shadowColor,
    shadowOpacity: brandElevation.soft.shadowOpacity,
    shadowRadius: brandElevation.soft.shadowRadius,
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
