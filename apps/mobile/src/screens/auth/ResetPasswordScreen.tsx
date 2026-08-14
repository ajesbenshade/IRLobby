import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { Field } from '@components/ui/Field';
import { useAuth } from '@hooks/useAuth';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export const ResetPasswordScreen = ({ navigation, route }: Props) => {
  const { resetPassword } = useAuth();
  const [token, setToken] = useState(route.params?.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const tokenValue = token.trim();
  const isPasswordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const isFormValid = useMemo(
    () => tokenValue.length > 0 && isPasswordValid && passwordsMatch,
    [isPasswordValid, passwordsMatch, tokenValue.length],
  );

  const { mutateAsync, isPending, error, isSuccess } = useMutation({
    mutationFn: () => resetPassword(tokenValue, password),
  });

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isPending) {
      return;
    }
    await mutateAsync();
  }, [isFormValid, isPending, mutateAsync]);

  return (
    <AuthShell
      eyebrow="Secure access"
      title="Choose a fresh password."
      subtitle="Paste the reset token from email and set a new password for your account."
      footer={
        <AppButton
          variant="ghost"
          compact
          onPress={() => navigation.navigate('Login')}
          disabled={isPending}
        >
          Back to sign in
        </AppButton>
      }
    >
      <AccentPill tone="secondary">Token-based reset</AccentPill>

      <View style={styles.form}>
        <Field
          label="Reset token"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="oneTimeCode"
        />
        <Field
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <Field
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          error={
            !passwordsMatch && confirmPassword.length > 0
              ? 'Passwords do not match.'
              : undefined
          }
        />

        {error ? (
          <Text style={styles.errorText}>
            {getErrorMessage(error, 'Could not reset password. Please try again.')}
          </Text>
        ) : null}

        {isSuccess ? (
          <Text style={styles.hintText}>Password updated successfully. You can sign in now.</Text>
        ) : null}

        <AppButton
          onPress={handleSubmit}
          disabled={!isFormValid || isPending}
          loading={isPending}
        >
          Update password
        </AppButton>
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  errorText: {
    color: appColors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  hintText: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
  },
});
