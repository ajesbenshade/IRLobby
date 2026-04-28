import {
  brand as sharedBrand,
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
 * Shared launch tokens live in packages/shared/design-tokens.ts. This file
 * preserves the mobile theme exports consumed by React Native Paper and screens.
 */

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

export const palette = {
  // Brand - purple to pink launch gradient
  primary: brandPalette.primary,
  primaryDeep: brandPalette.primaryDeep,
  primarySoft: brandPalette.primarySoft,
  primaryGlow: brandPalette.primaryGlow,

  // Secondary - electric cyan for matches and notifications
  secondary: brandPalette.secondary,
  secondaryDeep: brandPalette.secondaryDeep,
  secondarySoft: brandPalette.secondarySoft,

  // Accent - soft violet for hype moments and supporting surfaces
  accent: brandPalette.accent,
  accentDeep: brandPalette.accentDeep,
  accentSoft: brandPalette.accentSoft,

  // Status
  success: brandPalette.success,
  warning: brandPalette.warning,
  danger: brandPalette.danger,

  // Neutrals (light)
  ink: brandPalette.ink,
  mutedInk: brandPalette.mutedInk,
  softInk: brandPalette.softInk,
  line: brandPalette.line,
  lineStrong: brandPalette.lineStrong,
  surface: brandPalette.surface,
  surfaceMuted: brandPalette.surfaceMuted,
  background: brandPalette.background,
  overlay: brandPalette.overlay,
  white: brandPalette.white,
  black: brandPalette.black,

  // Neutrals (dark)
  darkBackground: brandPalette.darkBackground,
  darkSurface: brandPalette.darkSurface,
  darkSurfaceMuted: brandPalette.darkSurfaceMuted,
  darkLine: brandPalette.darkLine,
  darkInk: brandPalette.darkInk,
  darkMutedInk: brandPalette.darkMutedInk,
  darkSoftInk: brandPalette.darkSoftInk,
} as const;

// ---------------------------------------------------------------------------
// Radii — tighter, more modern
// ---------------------------------------------------------------------------

export const radii = {
  xs: brandRadii.xs,
  sm: brandRadii.sm,
  md: brandRadii.md,
  lg: brandRadii.lg,
  xl: brandRadii.xl,
  pill: brandRadii.pill,
} as const;

// ---------------------------------------------------------------------------
// Spacing — 4px base
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Type scale
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shadows — neutral, no pink tint
// ---------------------------------------------------------------------------

export const shadows = {
  // Subtle — for content cards and inputs
  card: {
    shadowColor: brandPalette.ink,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  // Stronger — for floating CTAs, tab bar, modals
  float: {
    shadowColor: brandPalette.primary,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  // Tight, sharp — for raised buttons (FAB)
  pop: {
    shadowColor: brandPalette.primaryDeep,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

// ---------------------------------------------------------------------------
// Motion — animation durations (ms)
// ---------------------------------------------------------------------------

export const motion = {
  fast: brandMotion.fast,
  base: brandMotion.base,
  slow: brandMotion.slow,
} as const;

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

export const brand = {
  name: sharedBrand.name,
  tagline: sharedBrand.tagline,
} as const;
