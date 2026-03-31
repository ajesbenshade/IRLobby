import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { View } from '@components/RNCompat';
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
        <Button mode="text" onPress={() => navigation.navigate('Login')} disabled={isPending} compact>
          Back to sign in
        </Button>
      }
    >
      <AccentPill tone="secondary">Token-based reset</AccentPill>

      <View style={styles.form}>
          <TextInput
            label="Reset token"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
          />

          {!passwordsMatch && confirmPassword.length > 0 && (
            <HelperText type="error" visible>
              Passwords do not match.
            </HelperText>
          )}

          {error && (
            <HelperText type="error" visible>
              {getErrorMessage(error, 'Could not reset password. Please try again.')}
            </HelperText>
          )}

          {isSuccess && (
            <HelperText type="info" visible>
              Password updated successfully. You can sign in now.
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!isFormValid || isPending}
            loading={isPending}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            buttonColor={appColors.primary}
          >
            Update password
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
});
