import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, radii, spacing } from '@theme/index';

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  accentLabel?: boolean;
};

export const Field = ({ label, error, style, accentLabel = false, ...props }: FieldProps) => (
  <View style={styles.wrap}>
    <Text style={[styles.label, accentLabel ? styles.labelAccent : null]}>{label}</Text>
    <TextInput
      placeholderTextColor={appColors.softInk}
      style={[styles.input, error ? styles.inputError : null, style]}
      {...props}
    />
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
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: appColors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    color: appColors.ink,
    fontSize: 16,
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
