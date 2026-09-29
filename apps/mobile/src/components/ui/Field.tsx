import { type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, radii, spacing } from '@theme/index';

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  accentLabel?: boolean;
  hideLabel?: boolean;
  leftIcon?: ReactNode;
  shape?: 'default' | 'pill';
};

export const Field = ({
  label,
  error,
  style,
  accentLabel = false,
  hideLabel = false,
  leftIcon,
  shape = 'default',
  ...props
}: FieldProps) => (
  <View style={styles.wrap}>
    {hideLabel ? null : (
      <Text style={[styles.label, accentLabel ? styles.labelAccent : null]}>{label}</Text>
    )}
    <View
      style={[
        styles.inputRow,
        shape === 'pill' ? styles.inputRowPill : null,
        error ? styles.inputError : null,
      ]}
    >
      {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
      <TextInput
        placeholderTextColor={appColors.softInk}
        style={[styles.input, leftIcon ? styles.inputWithIcon : null, style]}
        {...props}
        accessibilityLabel={label}
      />
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    color: appColors.mutedInk,
    fontSize: 13,
    fontWeight: '600',
  },
  labelAccent: {
    color: appColors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    backgroundColor: appColors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  inputRowPill: {
    borderRadius: radii.pill,
  },
  leftIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    color: appColors.ink,
    fontSize: 16,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  inputError: {
    borderColor: appColors.danger,
  },
  error: {
    color: appColors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
});
