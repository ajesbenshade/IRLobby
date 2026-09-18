import { type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { appColors, appTypography, radii } from '@theme/index';
import { palette } from '@theme/tokens';

type ButtonVariant = 'contained' | 'outline' | 'ghost' | 'social';

type AppButtonProps = PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  accessibilityLabel?: string;
}>;

export const AppButton = ({
  children,
  onPress,
  disabled = false,
  loading = false,
  variant = 'contained',
  compact = false,
  style,
  textColor,
  accessibilityLabel,
}: AppButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        variant === 'contained' ? styles.contained : null,
        variant === 'outline' ? styles.outline : null,
        variant === 'ghost' ? styles.ghost : null,
        variant === 'social' ? styles.social : null,
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'contained' ? appColors.white : appColors.primaryGlow
          }
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'contained' ? styles.labelContained : styles.labelQuiet,
            textColor ? { color: textColor } : null,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  regular: {
    minHeight: 48,
    paddingHorizontal: 20,
  },
  compact: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  contained: {
    backgroundColor: appColors.primary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.lineStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  social: {
    backgroundColor: palette.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.glassBorder,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontFamily: appTypography.bodySemibold,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  labelContained: {
    color: appColors.white,
  },
  labelQuiet: {
    color: appColors.ink,
  },
});
