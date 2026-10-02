import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, appTypography, radii } from '@theme/index';

/** Disabled and pressed colours from the design spec "button-states". */
export const DISABLED_FILL = '#e1dbd7';
export const DISABLED_OUTLINE_FILL = '#f3f0ee';
export const DISABLED_OUTLINE = '#cec8c4';
export const DISABLED_TEXT = '#7a7572';
export const PRESSED_TINT = '#f9e8ee';
export const MIN_TARGET = 54;

/**
 * Literal hex values for the filled pills. They are deliberately NOT read from the theme or from a
 * Pressable style callback: a TestFlight build showed confirm buttons as white text on a white
 * background, so the fill is applied inline as a plain colour string and unit-tested.
 */
export const PILL_BURGUNDY = '#a2033f';
export const PILL_BURGUNDY_PRESSED = '#800232';
export const PILL_DESTRUCTIVE = '#8a0a1f';
export const PILL_DESTRUCTIVE_PRESSED = '#680617';
export const PILL_WHITE = '#ffffff';
export const PILL_INK = '#222222';
export const PILL_CREAM = '#f6f1ee';

export type PillVariant = 'primary' | 'outline' | 'text' | 'destructive' | 'destructiveOutline';

export type PillColors = { backgroundColor: string; borderColor: string; borderWidth: number; textColor: string };

/** Pure colour table for every pill state (see button-states.png). */
export const pillColors = (
  variant: PillVariant,
  state: { disabled?: boolean; loading?: boolean; pressed?: boolean; tone?: 'burgundy' | 'ink' } = {},
): PillColors => {
  const inactive = Boolean(state.disabled);
  const busy = Boolean(state.loading);
  const pressed = Boolean(state.pressed) && !inactive;
  switch (variant) {
    case 'primary':
      if (inactive && !busy) {
        return { backgroundColor: DISABLED_FILL, borderColor: DISABLED_FILL, borderWidth: 0, textColor: DISABLED_TEXT };
      }
      return {
        backgroundColor: pressed || busy ? PILL_BURGUNDY_PRESSED : PILL_BURGUNDY,
        borderColor: PILL_BURGUNDY,
        borderWidth: 0,
        textColor: PILL_WHITE,
      };
    case 'destructive':
      if (inactive && !busy) {
        return { backgroundColor: DISABLED_FILL, borderColor: DISABLED_FILL, borderWidth: 0, textColor: DISABLED_TEXT };
      }
      return {
        backgroundColor: pressed || busy ? PILL_DESTRUCTIVE_PRESSED : PILL_DESTRUCTIVE,
        borderColor: PILL_DESTRUCTIVE,
        borderWidth: 0,
        textColor: PILL_WHITE,
      };
    case 'destructiveOutline':
      if (inactive) {
        return { backgroundColor: DISABLED_OUTLINE_FILL, borderColor: DISABLED_OUTLINE, borderWidth: 1.5, textColor: DISABLED_TEXT };
      }
      return {
        backgroundColor: pressed ? PRESSED_TINT : PILL_CREAM,
        borderColor: PILL_DESTRUCTIVE,
        borderWidth: 1.5,
        textColor: PILL_DESTRUCTIVE,
      };
    case 'outline':
      if (inactive) {
        return { backgroundColor: DISABLED_OUTLINE_FILL, borderColor: DISABLED_OUTLINE, borderWidth: 1.5, textColor: DISABLED_TEXT };
      }
      return {
        backgroundColor: pressed ? PRESSED_TINT : 'transparent',
        borderColor: PILL_INK,
        borderWidth: 1.5,
        textColor: PILL_INK,
      };
    default:
      return {
        backgroundColor: pressed ? PRESSED_TINT : 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        textColor: inactive ? DISABLED_TEXT : state.tone === 'ink' ? PILL_INK : PILL_BURGUNDY,
      };
  }
};

type PillButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: PillVariant;
  disabled?: boolean;
  loading?: boolean;
  /** Shown next to the spinner while loading (e.g. `Posting…`). Without it the label is replaced by the spinner. */
  loadingLabel?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Text buttons only: burgundy (default) or ink. */
  tone?: 'burgundy' | 'ink';
};

/**
 * One pill button for every Foyer screen. 54pt minimum, grows with its label,
 * readable disabled state, and ignores taps while a request is in flight.
 */
export const PillButton = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  loadingLabel,
  icon,
  accessibilityLabel,
  style,
  testID,
  tone,
}: PillButtonProps) => {
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;
  const colors = pillColors(variant, { disabled: inactive, loading, pressed, tone });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (loading && loadingLabel ? loadingLabel : label)}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.pill,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: colors.borderWidth,
        },
        style,
      ]}
    >
      {loading && !loadingLabel ? (
        <ActivityIndicator color={colors.textColor} />
      ) : (
        <View style={styles.pillRow}>
          {loading ? <ActivityIndicator color={colors.textColor} /> : null}
          {!loading && icon ? <MaterialCommunityIcons name={icon} size={20} color={colors.textColor} /> : null}
          <Text style={[styles.pillLabel, { color: colors.textColor }]}>{loading && loadingLabel ? loadingLabel : label}</Text>
        </View>
      )}
    </Pressable>
  );
};

/** Primary on top, outline Cancel below, 10pt apart, as the spec asks for every sheet. */
export const SheetButtons = ({ children }: PropsWithChildren) => <View style={styles.sheetButtons}>{children}</View>;

export const InlineError = ({ message }: { message?: string | null }) =>
  message ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  ) : null;

type EmptyStateProps = {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
};

export const EmptyState = ({ icon = 'account-multiple-outline', title, body }: EmptyStateProps) => (
  <View style={styles.empty}>
    <View style={styles.emptyCircle}>
      <MaterialCommunityIcons name={icon} size={32} color={appColors.primary} />
    </View>
    <Text accessibilityRole="header" style={styles.emptyTitle}>
      {title}
    </Text>
    <Text style={styles.emptyBody}>{body}</Text>
  </View>
);

type ToastProps = {
  message: string;
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  bottom?: number;
  /** Dismiss itself after this many ms (error toasts use 5000). */
  autoDismissMs?: number;
};

export const Toast = ({ message, action, onDismiss, icon = 'check-circle', bottom = 24, autoDismissMs }: ToastProps) => {
  useEffect(() => {
    if (!autoDismissMs || !onDismiss) {
      return undefined;
    }
    const id = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismissMs, message]);
  return (
  <View style={[styles.toast, { bottom }]} accessibilityLiveRegion="polite">
    <MaterialCommunityIcons name={icon} size={20} color={icon === 'check-circle' ? '#e98aa8' : '#f6f1ee'} />
    <Text style={styles.toastText}>{message}</Text>
    {action ? (
      <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={styles.toastAction}>
        <Text style={styles.toastActionText}>{action.label}</Text>
      </Pressable>
    ) : null}
    {onDismiss ? (
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} style={styles.toastAction}>
        <MaterialCommunityIcons name="close" size={18} color="#f6f1ee" />
      </Pressable>
    ) : null}
  </View>
  );
};

export const SectionLabel = ({ children }: { children: ReactNode }) => <Text style={styles.sectionLabel}>{children}</Text>;

export const Avatar = ({ initials, size = 44 }: { initials: string; size?: number }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={styles.avatarText}>{initials}</Text>
  </View>
);

const styles = StyleSheet.create({
  pill: {
    minHeight: MIN_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  pillRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 },
  pillLabel: { fontFamily: appTypography.bodySemibold, fontSize: 16, lineHeight: 22, textAlign: 'center', flexShrink: 1 },
  sheetButtons: { gap: 10 },
  error: { color: appColors.primary, fontFamily: appTypography.bodyMedium, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 40, paddingHorizontal: 24 },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: appColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: appTypography.heading, fontSize: 20, lineHeight: 28, color: appColors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.mutedInk, textAlign: 'center' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#222222',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: { flex: 1, color: '#f6f1ee', fontFamily: appTypography.bodyMedium, fontSize: 14, lineHeight: 20 },
  toastAction: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  toastActionText: { color: '#e98aa8', fontFamily: appTypography.bodySemibold, fontSize: 15 },
  sectionLabel: { fontFamily: appTypography.bodySemibold, fontSize: 11.5, letterSpacing: 0.6, color: appColors.mutedInk },
  avatar: { backgroundColor: appColors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 14 },
});
