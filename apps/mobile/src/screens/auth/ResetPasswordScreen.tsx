import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput, useTheme } from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export const ResetPasswordScreen = ({ navigation, route }: Props) => {
  const theme = useTheme();
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Surface elevation={2} style={styles.card}>
        <Text variant="headlineMedium" style={styles.title}>
          Set a new password
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Enter the reset token from your email and choose a new password.
        </Text>

        <View style={styles.form}>
          <TextInput
            label="Reset token"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <TextInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
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
          >
            Update password
          </Button>
        </View>

        <Button mode="text" onPress={() => navigation.navigate('Login')} disabled={isPending}>
          Back to sign in
        </Button>
      </Surface>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748b',
  },
  form: {
    gap: 12,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'transparent',
  },
  submitButton: {
    marginTop: 12,
  },
});
