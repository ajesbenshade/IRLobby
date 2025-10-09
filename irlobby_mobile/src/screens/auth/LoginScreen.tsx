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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isFormValid = useMemo(() => email.trim().length > 0 && password.length >= 8, [email, password]);

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: () => signIn({ email: email.trim().toLowerCase(), password }),
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
          Welcome back
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Sign in to discover nearby IRL activities.
        </Text>

        <View style={styles.form}>
          <TextInput
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            label="Password"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          {error && (
            <HelperText type="error" visible>
              {getErrorMessage(error, 'Unable to sign in. Please try again.')}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!isFormValid}
            loading={isPending}
            style={styles.submitButton}
          >
            Sign in
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={isPending}
            style={styles.linkButton}
          >
            Forgot password?
          </Button>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMedium">New to IRLobby?</Text>
          <Button mode="text" onPress={() => navigation.navigate('Register')} disabled={isPending}>
            Create an account
          </Button>
        </View>
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
  linkButton: {
    alignSelf: 'flex-start',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 16,
  },
});
