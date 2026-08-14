import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, radii, spacing } from '@theme/index';

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export const Field = ({ label, error, style, ...props }: FieldProps) => (
  <View style={styles.wrap}>
    <Text style={styles.label}>{label}</Text>
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
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: appColors.cardStrong,
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
