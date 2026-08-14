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

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');

  const isFormValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  const { mutateAsync, isPending, error, isSuccess } = useMutation({
    mutationFn: () => requestPasswordReset(email.trim().toLowerCase()),
  });

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isPending) {
      return;
    }
    await mutateAsync();
  }, [isFormValid, isPending, mutateAsync]);

  return (
    <AuthShell
      eyebrow="Recovery"
      title="Get back in quickly."
      subtitle="Enter the email tied to your profile and we’ll send reset instructions if the account exists."
      footer={
        <View style={styles.footer}>
          <AppButton variant="ghost" compact onPress={() => navigation.goBack()} disabled={isPending}>
            Back to sign in
          </AppButton>
          <AppButton
            variant="ghost"
            compact
            onPress={() => navigation.navigate('ResetPassword')}
            disabled={isPending}
          >
            I have a token
          </AppButton>
        </View>
      }
    >
      <AccentPill tone="neutral">Password support</AccentPill>

      <View style={styles.form}>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        {error ? (
          <Text style={styles.errorText}>
            {getErrorMessage(error, 'Could not send reset email. Please try again.')}
          </Text>
        ) : null}
        {isSuccess ? (
          <Text style={styles.hintText}>
            If an account exists for this email, a reset link is on the way.
          </Text>
        ) : null}

        <AppButton onPress={handleSubmit} disabled={!isFormValid} loading={isPending}>
          Send reset link
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
  footer: {
    gap: 8,
  },
});
