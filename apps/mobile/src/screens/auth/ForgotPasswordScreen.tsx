import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { AccentPill, AuthShell } from '@components/AppChrome';
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
          <Button mode="text" onPress={() => navigation.goBack()} disabled={isPending} compact>
            Back to sign in
          </Button>
          <Button mode="text" onPress={() => navigation.navigate('ResetPassword')} disabled={isPending} compact>
            I have a token
          </Button>
        </View>
      }
    >
      <AccentPill tone="neutral">Password support</AccentPill>

      <View style={styles.form}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            mode="outlined"
            style={styles.input}
          />
          {error && (
            <HelperText type="error" visible>
              {getErrorMessage(error, 'Could not send reset email. Please try again.')}
            </HelperText>
          )}
          {isSuccess && (
            <HelperText type="info" visible>
              If an account exists for this email, a reset link is on the way.
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!isFormValid}
            loading={isPending}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            buttonColor={appColors.primary}
          >
            Send reset link
          </Button>
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
  input: {
    backgroundColor: appColors.card,
  },
  submitButton: {
    marginTop: 12,
    borderRadius: 18,
  },
  submitButtonContent: {
    minHeight: 52,
  },
  footer: {
    gap: 8,
  },
});
