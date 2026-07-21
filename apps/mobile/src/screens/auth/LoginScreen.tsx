import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  Button,
  Divider,
  HelperText,
  Text,
} from 'react-native-paper';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { View } from '@components/RNCompat';
import { config } from '@constants/config';
import { useAuth } from '@hooks/useAuth';
import { isAppleSignInAvailable, isGoogleSignInConfigured } from '@services/authService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen = ({ navigation }: Props) => {
  const { signIn, signInWithTwitter, signInWithApple, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  const isFormValid = useMemo(() => email.trim().length > 0 && password.length >= 8, [email, password]);

  useEffect(() => {
    let isMounted = true;

    const checkProviders = async () => {
      const [apple, google] = await Promise.all([
        isAppleSignInAvailable(),
        isGoogleSignInConfigured(),
      ]);
      if (isMounted) {
        setAppleAvailable(apple);
        setGoogleAvailable(google);
      }
    };

    void checkProviders();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const {
    mutateAsync: signInWithAppleAsync,
    isPending: isApplePending,
    error: appleError,
  } = useMutation({
    mutationFn: () => signInWithApple(),
  });

  const {
    mutateAsync: signInWithGoogleAsync,
    isPending: isGooglePending,
    error: googleError,
  } = useMutation({
    mutationFn: () => signInWithGoogle(),
  });

  const isBusy = isPending || isTwitterPending || isApplePending || isGooglePending;
  const authError = error ?? twitterError ?? appleError ?? googleError;

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

  const handleAppleSignIn = useCallback(async () => {
    if (isBusy) {
      return;
    }

    await signInWithAppleAsync();
  }, [isBusy, signInWithAppleAsync]);

  const handleGoogleSignIn = useCallback(async () => {
    if (isBusy) {
      return;
    }

    await signInWithGoogleAsync();
  }, [isBusy, signInWithGoogleAsync]);

  return (
    <AuthShell
      eyebrow="IRLobby"
      title="Find your people fast."
      subtitle="Sign in to spot nearby plans, keep the group chat warm, and turn a maybe into an actual night out."
      footer={
        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>New here?</Text>
          <Button mode="text" onPress={() => navigation.navigate('Register')} disabled={isBusy} compact>
            Create an account
          </Button>
        </View>
      }
    >
      <View style={styles.heroRow}>
        <AccentPill>Good plans only</AccentPill>
        <Text style={styles.heroMetric}>Nearby hangs, better group chats, and fewer "we should do something" texts.</Text>
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
            {Platform.OS === 'ios' && appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={999}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            ) : null}
            {googleAvailable ? (
              <Button
                mode="outlined"
                onPress={handleGoogleSignIn}
                disabled={isBusy}
                loading={isGooglePending}
                style={styles.oauthButton}
              >
                Continue with Google
              </Button>
            ) : null}
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
    borderRadius: 999,
  },
  submitButtonContent: {
    minHeight: 54,
  },
  linkButton: {
    alignSelf: 'flex-start',
  },
  oauthSection: {
    marginTop: 4,
    gap: 12,
  },
  oauthButton: {
    borderRadius: 999,
  },
  appleButton: {
    width: '100%',
    height: 54,
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
