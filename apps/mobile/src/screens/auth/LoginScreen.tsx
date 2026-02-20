import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  Surface,
  Divider,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { config } from '@constants/config';
import { useAuth } from '@hooks/useAuth';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen = ({ navigation }: Props) => {
  const theme = useTheme();
  const { signIn, signInWithTwitter } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isFormValid = useMemo(() => email.trim().length > 0 && password.length >= 8, [email, password]);

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: () => signIn({ email: email.trim().toLowerCase(), password }),
  });

  const {
    mutateAsync: signInWithTwitterAsync,
    isPending: isTwitterPending,
    error: twitterError,
  } = useMutation({
    mutationFn: () => signInWithTwitter(),
  });

  const isBusy = isPending || isTwitterPending;
  const authError = error ?? twitterError;

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isBusy) {
      return;
    }

    await mutateAsync();
  }, [isFormValid, isBusy, mutateAsync]);

  const handleTwitterSignIn = useCallback(async () => {
    if (isBusy) {
      return;
    }

    await signInWithTwitterAsync();
  }, [isBusy, signInWithTwitterAsync]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Surface elevation={2} style={styles.card}>
        <Text variant="headlineMedium" style={styles.title}>
          Welcome back
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }] }>
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
          {authError && (
            <HelperText type="error" visible>
              {getErrorMessage(authError, 'Unable to sign in. Please try again.')}
            </HelperText>
          )}

          {config.isUsingFallbackApiBaseUrl && (
            <HelperText type="info" visible>
              Using default backend URL: {config.apiBaseUrl}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!isFormValid || isBusy}
            loading={isPending}
            style={styles.submitButton}
          >
            Sign in
          </Button>

          <View style={styles.oauthSection}>
            <Divider />
            <Button
              mode="outlined"
              onPress={handleTwitterSignIn}
              disabled={isBusy}
              loading={isTwitterPending}
            >
              Continue with X
            </Button>
          </View>

          <Button
            mode="text"
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={isBusy}
            style={styles.linkButton}
          >
            Forgot password?
          </Button>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMedium">New to IRLobby?</Text>
          <Button mode="text" onPress={() => navigation.navigate('Register')} disabled={isBusy}>
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
  oauthSection: {
    marginTop: 4,
    gap: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 16,
  },
});
