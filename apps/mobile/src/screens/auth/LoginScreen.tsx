import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Button, Divider, HelperText, Text } from 'react-native-paper';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { View } from '@components/RNCompat';
import { config } from '@constants/config';
import { auth as authCopy } from '@constants/copy';
import { useAuth } from '@hooks/useAuth';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen = ({ navigation }: Props) => {
  const {
    signIn,
    signInWithAppleIdentityToken,
    signInWithGoogleIdToken,
    signInWithTwitter,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const isFormValid = useMemo(
    () => email.trim().length > 0 && password.length >= 8,
    [email, password]
  );
  const isGoogleConfigured = useMemo(
    () =>
      Boolean(
        config.googleExpoClientId ||
          config.googleIosClientId ||
          config.googleAndroidClientId ||
          config.googleWebClientId
      ),
    []
  );

  const [googleRequest, , promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: config.googleExpoClientId,
    iosClientId: config.googleIosClientId,
    androidClientId: config.googleAndroidClientId,
    webClientId: config.googleWebClientId,
    scopes: ['profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    let isMounted = true;

    const checkAppleAvailability = async () => {
      if (Platform.OS !== 'ios') {
        return;
      }

      const available = await AppleAuthentication.isAvailableAsync();
      if (isMounted) {
        setIsAppleAvailable(available);
      }
    };

    void checkAppleAvailability();

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
    mutateAsync: signInWithGoogleAsync,
    isPending: isGooglePending,
    error: googleError,
  } = useMutation({
    mutationFn: async () => {
      if (!isGoogleConfigured || !googleRequest) {
        throw new Error('Google sign-in is not configured on this build yet.');
      }

      const authResult = await promptGoogleAsync();
      if (authResult.type !== 'success') {
        throw new Error('Google sign-in was cancelled.');
      }

      const idToken = authResult.params?.id_token;
      if (typeof idToken !== 'string' || !idToken) {
        throw new Error('Google sign-in did not return an identity token.');
      }

      return signInWithGoogleIdToken(idToken);
    },
  });

  const {
    mutateAsync: signInWithAppleAsync,
    isPending: isApplePending,
    error: appleError,
  } = useMutation({
    mutationFn: async () => {
      if (!isAppleAvailable) {
        throw new Error('Apple sign-in is not available on this device.');
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple sign-in did not return an identity token.');
      }

      return signInWithAppleIdentityToken({
        identityToken: credential.identityToken,
        email: credential.email,
        firstName: credential.fullName?.givenName,
        lastName: credential.fullName?.familyName,
      });
    },
  });

  const isBusy =
    isPending || isTwitterPending || isGooglePending || isApplePending;
  const authError = error ?? twitterError ?? googleError ?? appleError;

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

  const handleGoogleSignIn = useCallback(async () => {
    if (isBusy) {
      return;
    }

    await signInWithGoogleAsync();
  }, [isBusy, signInWithGoogleAsync]);

  const handleAppleSignIn = useCallback(async () => {
    if (isBusy) {
      return;
    }

    await signInWithAppleAsync();
  }, [isBusy, signInWithAppleAsync]);

  return (
    <AuthShell
      eyebrow={authCopy.login.eyebrow}
      title={authCopy.login.title}
      subtitle={authCopy.login.subtitle}
      footer={
        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>
            {authCopy.login.footerPrompt}
          </Text>
          <Button
            mode="text"
            onPress={() => navigation.navigate('Register')}
            disabled={isBusy}
            compact
          >
            {authCopy.login.footerCta}
          </Button>
        </View>
      }
    >
      <View style={styles.heroRow}>
        <AccentPill>{authCopy.login.pillText}</AccentPill>
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
          {authCopy.login.primaryCta}
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
            {authCopy.login.twitterCta}
          </Button>
          <Button
            mode="outlined"
            onPress={handleGoogleSignIn}
            disabled={isBusy || !isGoogleConfigured || !googleRequest}
            loading={isGooglePending}
            style={styles.oauthButton}
          >
            {authCopy.login.googleCta}
          </Button>
          {isAppleAvailable && (
            <Button
              mode="outlined"
              onPress={handleAppleSignIn}
              disabled={isBusy}
              loading={isApplePending}
              style={styles.oauthButton}
            >
              {authCopy.login.appleCta}
            </Button>
          )}
        </View>

        <Button
          mode="text"
          onPress={() => navigation.navigate('ForgotPassword')}
          disabled={isBusy}
          style={styles.linkButton}
        >
          {authCopy.login.forgotPassword}
        </Button>
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  heroRow: {
    gap: 10,
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
