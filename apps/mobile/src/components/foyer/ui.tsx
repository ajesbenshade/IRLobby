import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { PropsWithChildren, ReactNode } from 'react';
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

type PillVariant = 'primary' | 'outline' | 'text';

type PillButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: PillVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
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
  icon,
  accessibilityLabel,
  style,
}: PillButtonProps) => {
  const inactive = disabled || loading;
  const textColor =
    variant === 'primary'
      ? inactive
        ? DISABLED_TEXT
        : appColors.white
      : inactive
        ? DISABLED_TEXT
        : variant === 'text'
          ? appColors.primary
          : appColors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        variant === 'primary' ? styles.primary : null,
        variant === 'outline' ? styles.outline : null,
        variant === 'text' ? styles.textButton : null,
        variant === 'primary' && inactive && !loading ? { backgroundColor: DISABLED_FILL } : null,
        variant === 'outline' && inactive && !loading
          ? { backgroundColor: DISABLED_OUTLINE_FILL, borderColor: DISABLED_OUTLINE }
          : null,
        pressed && !inactive
          ? variant === 'primary'
            ? { backgroundColor: appColors.primaryDeep }
            : { backgroundColor: PRESSED_TINT }
          : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? appColors.white : appColors.primary} />
      ) : (
        <View style={styles.pillRow}>
          {icon ? <MaterialCommunityIcons name={icon} size={20} color={textColor} /> : null}
          <Text style={[styles.pillLabel, { color: textColor }]}>{label}</Text>
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
};

export const Toast = ({ message, action, onDismiss, icon = 'check-circle', bottom = 24 }: ToastProps) => (
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
  primary: { backgroundColor: appColors.primary },
  outline: { borderWidth: 1.5, borderColor: appColors.ink, backgroundColor: 'transparent' },
  textButton: { backgroundColor: 'transparent' },
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
