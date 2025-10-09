import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const theme = useTheme();
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Surface elevation={2} style={styles.card}>
        <Text variant="headlineMedium" style={styles.title}>
          Reset your password
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Enter the email linked to your account and we will send you reset instructions.
        </Text>

        <View style={styles.form}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
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
          >
            Send reset link
          </Button>
        </View>

        <Button mode="text" onPress={() => navigation.goBack()} disabled={isPending}>
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
