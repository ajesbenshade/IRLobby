import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { Field } from '@components/ui/Field';
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
        throw new Error(authCopy.login.googleNotConfigured);
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
          <Text style={styles.footerText}>
            {authCopy.login.footerPrompt}
          </Text>
          <AppButton
            variant="ghost"
            compact
            onPress={() => navigation.navigate('Register')}
            disabled={isBusy}
          >
            {authCopy.login.footerCta}
          </AppButton>
        </View>
      }
    >
      <View style={styles.heroRow}>
        <AccentPill>{authCopy.login.pillText}</AccentPill>
      </View>

      <View style={styles.form}>
        <Field
          label="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Password"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />
        {authError ? (
          <Text style={styles.errorText}>
            {getErrorMessage(authError, 'Unable to sign in. Please try again.')}
          </Text>
        ) : null}

        {config.isUsingFallbackApiBaseUrl ? (
          <Text style={styles.hintText}>Using default backend URL: {config.apiBaseUrl}</Text>
        ) : null}

        <AppButton
          onPress={handleSubmit}
          disabled={!isFormValid || isBusy}
          loading={isPending}
        >
          {authCopy.login.primaryCta}
        </AppButton>

        <View style={styles.oauthSection}>
          <View style={styles.divider} />
          {isAppleAvailable ? (
            <AppButton
              variant="social"
              onPress={handleAppleSignIn}
              disabled={isBusy}
              loading={isApplePending}
            >
              {authCopy.login.appleCta}
            </AppButton>
          ) : null}
          <AppButton
            variant="social"
            onPress={handleGoogleSignIn}
            disabled={isBusy || !isGoogleConfigured || !googleRequest}
            loading={isGooglePending}
          >
            {authCopy.login.googleCta}
          </AppButton>
          {!isGoogleConfigured ? (
            <Text style={styles.hintText}>{authCopy.login.googleNotConfigured}</Text>
          ) : null}
          <AppButton
            variant="social"
            onPress={handleTwitterSignIn}
            disabled={isBusy}
            loading={isTwitterPending}
          >
            {authCopy.login.twitterCta}
          </AppButton>
        </View>

        <AppButton
          variant="ghost"
          onPress={() => navigation.navigate('ForgotPassword')}
          disabled={isBusy}
          style={styles.linkButton}
        >
          {authCopy.login.forgotPassword}
        </AppButton>
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
  linkButton: {
    alignSelf: 'flex-start',
  },
  oauthSection: {
    marginTop: 4,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: appColors.line,
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
