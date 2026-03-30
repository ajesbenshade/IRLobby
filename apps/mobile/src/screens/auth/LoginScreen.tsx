import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Divider,
  HelperText,
  Text,
  TextInput,
} from 'react-native-paper';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { config } from '@constants/config';
import { useAuth } from '@hooks/useAuth';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen = ({ navigation }: Props) => {
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
    <AuthShell
      eyebrow="IRLobby"
      title="Real plans, real people."
      subtitle="Sign in to discover nearby activities, keep your chats moving, and turn swipes into actual plans."
      footer={
        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>New to IRLobby?</Text>
          <Button mode="text" onPress={() => navigation.navigate('Register')} disabled={isBusy} compact>
            Create an account
          </Button>
        </View>
      }
    >
      <View style={styles.heroRow}>
        <AccentPill>Production preview</AccentPill>
        <Text style={styles.heroMetric}>Nearby, curated, and worth leaving the house for.</Text>
      </View>

      <View style={styles.form}>
          <TextInput
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Password"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
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
            contentStyle={styles.submitButtonContent}
            buttonColor={appColors.primary}
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
              style={styles.oauthButton}
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
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  heroRow: {
    gap: 10,
  },
  heroMetric: {
    color: appColors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
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
  linkButton: {
    alignSelf: 'flex-start',
  },
  oauthSection: {
    marginTop: 4,
    gap: 12,
  },
  oauthButton: {
    borderRadius: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  footerText: {
    color: appColors.mutedInk,
  },
});
