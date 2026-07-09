import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet } from 'react-native';
import { Button, Checkbox, Divider, HelperText, Text } from 'react-native-paper';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { View } from '@components/RNCompat';
import { config } from '@constants/config';
import { auth as authCopy } from '@constants/copy';
import { useAuth } from '@hooks/useAuth';
import { updateOnboarding } from '@services/authService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

const TERMS_URL = 'https://irlobby.com/terms-of-service';
const PRIVACY_URL = 'https://irlobby.com/privacy-policy';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen = ({ navigation }: Props) => {
  const {
    signUp,
    signInWithAppleIdentityToken,
    signInWithGoogleIdToken,
    signInWithTwitter,
  } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const passwordsMatch = password.length >= 8 && password === confirmPassword;

  const isFormValid = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      username.trim().length >= 3 &&
      passwordsMatch &&
      acceptedLegal,
    [acceptedLegal, email, firstName, lastName, passwordsMatch, username],
  );

  const isGoogleConfigured = useMemo(
    () =>
      Boolean(
        config.googleExpoClientId ||
          config.googleIosClientId ||
          config.googleAndroidClientId ||
          config.googleWebClientId,
      ),
    [],
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
    mutationFn: async () => {
      const user = await signUp({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim(),
        password,
      });
      // Persist legal acceptance immediately so new users don't have to
      // re-accept inside onboarding.
      try {
        await updateOnboarding({ terms_accepted: true, privacy_accepted: true });
      } catch {
        // Non-fatal: the user is already created; legal will be re-prompted
        // by the backend or in settings if needed.
      }
      return user;
    },
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
        throw new Error(authCopy.register.googleNotConfigured);
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

  const openLegalUrl = (url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  };

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isBusy) {
      return;
    }

    await mutateAsync();
  }, [isFormValid, isBusy, mutateAsync]);

  const handleTwitterSignIn = useCallback(async () => {
    if (isBusy || !acceptedLegal) {
      return;
    }

    await signInWithTwitterAsync();
  }, [acceptedLegal, isBusy, signInWithTwitterAsync]);

  const handleGoogleSignIn = useCallback(async () => {
    if (isBusy || !acceptedLegal) {
      return;
    }

    await signInWithGoogleAsync();
  }, [acceptedLegal, isBusy, signInWithGoogleAsync]);

  const handleAppleSignIn = useCallback(async () => {
    if (isBusy || !acceptedLegal) {
      return;
    }

    await signInWithAppleAsync();
  }, [acceptedLegal, isBusy, signInWithAppleAsync]);

  return (
    <AuthShell
      eyebrow={authCopy.register.eyebrow}
      title={authCopy.register.title}
      subtitle={authCopy.register.subtitle}
      footer={
        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>
            {authCopy.register.footerPrompt}
          </Text>
          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            disabled={isBusy}
            compact
          >
            {authCopy.register.footerCta}
          </Button>
        </View>
      }
    >
      <AccentPill tone="secondary">Real plans, real fast</AccentPill>

      <View style={styles.form}>
        <TextInput
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          mode="outlined"
          style={styles.input}
        />
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
        <TextInput
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoComplete="username"
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Confirm password"
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
        {authError && (
          <HelperText type="error" visible>
            {getErrorMessage(authError, authCopy.register.fallbackError)}
          </HelperText>
        )}

        <View style={styles.legalRow}>
          <Checkbox
            status={acceptedLegal ? 'checked' : 'unchecked'}
            onPress={() => setAcceptedLegal((prev) => !prev)}
            color={appColors.primary}
          />
          <View style={styles.legalCopy}>
            <Text style={styles.legalText}>
              I agree to the{' '}
              <Text style={styles.legalLink} onPress={() => openLegalUrl(TERMS_URL)}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                style={styles.legalLink}
                onPress={() => openLegalUrl(PRIVACY_URL)}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </View>

        {!acceptedLegal && (
          <HelperText type="info" visible>
            {authCopy.register.legalRequired}
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
          {authCopy.register.primaryCta}
        </Button>

        <View style={styles.oauthSection}>
          <Divider />
          <Button
            mode="outlined"
            onPress={handleTwitterSignIn}
            disabled={isBusy || !acceptedLegal}
            loading={isTwitterPending}
            style={styles.oauthButton}
          >
            {authCopy.register.twitterCta}
          </Button>
          <Button
            mode="outlined"
            onPress={handleGoogleSignIn}
            disabled={
              isBusy ||
              !acceptedLegal ||
              !isGoogleConfigured ||
              !googleRequest
            }
            loading={isGooglePending}
            style={styles.oauthButton}
          >
            {authCopy.register.googleCta}
          </Button>
          {!isGoogleConfigured && (
            <HelperText type="info" visible>
              {authCopy.register.googleNotConfigured}
            </HelperText>
          )}
          {isAppleAvailable && (
            <Button
              mode="outlined"
              onPress={handleAppleSignIn}
              disabled={isBusy || !acceptedLegal}
              loading={isApplePending}
              style={styles.oauthButton}
            >
              {authCopy.register.appleCta}
            </Button>
          )}
        </View>
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
  oauthSection: {
    marginTop: 4,
    gap: 12,
  },
  oauthButton: {
    borderRadius: 999,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 4,
  },
  legalCopy: {
    flex: 1,
    paddingTop: 8,
  },
  legalText: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  legalLink: {
    color: appColors.primary,
    fontWeight: '600',
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
