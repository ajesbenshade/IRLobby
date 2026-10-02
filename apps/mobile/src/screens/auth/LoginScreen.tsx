import * as AppleAuthentication from 'expo-apple-authentication';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleSignInButton } from '@components/GoogleSignInButton';
import { AuthSignInToast } from '@components/AuthSignInToast';
import { IrlobbyLoginMark } from '@components/IrlobbyLoginMark';
import { View } from '@components/RNCompat';
import { AppleSignInButton } from '@components/AppleSignInButton';
import { SocialAuthButton } from '@components/SocialAuthButton';
import { Field } from '@components/ui/Field';
import { config } from '@constants/config';
import { auth as authCopy } from '@constants/copy';
import { useAuth } from '@hooks/useAuth';
import { appColors, appTypography, loginGradients, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';
import { refreshAppConfig, useAppConfig } from '@services/appConfig';
import { persistLegalAcceptance } from '@services/authService';
import { useLegalSheet } from '@components/foyer/LegalWebViewSheet';
import { LegalConsentText } from '@components/foyer/LegalConsentText';

import type { AuthStackParamList } from '@navigation/types';

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

/** Login shows "By continuing you agree to the Terms of Use and Privacy Policy." on the same screen as the social buttons. */
const LOGIN_ACCEPTED_LEGAL = true;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;


export const LoginScreen = ({ navigation }: Props) => {
  const legal = useAppConfig();
  const legalSheet = useLegalSheet();
  useEffect(() => {
    void refreshAppConfig();
  }, []);
  const {
    signIn,
    signInWithAppleIdentityToken,
    signInWithGoogleIdToken,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [signInToast, setSignInToast] = useState<'google' | null>(null);
  const [googleRetryNonce, setGoogleRetryNonce] = useState(0);

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
    mutateAsync: signInWithGoogleAsync,
    isPending: isGooglePending,
    error: googleError,
  } = useMutation({
    mutationFn: async (idToken: string) => {
      // The consent line on this screen ("By continuing you agree to ...") covers a new account made here,
      // so Login sends the same Terms / Privacy flags as Sign up.
      const result = await signInWithGoogleIdToken(idToken, { acceptedLegal: LOGIN_ACCEPTED_LEGAL });
      await persistLegalAcceptance();
      return result;
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

      const result = await signInWithAppleIdentityToken({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        email: credential.email,
        firstName: credential.fullName?.givenName,
        lastName: credential.fullName?.familyName,
        acceptedLegal: LOGIN_ACCEPTED_LEGAL,
      });
      await persistLegalAcceptance();
      return result;
    },
  });

  const isBusy = isPending || isGooglePending || isApplePending;
  const authError = error ?? googleError ?? appleError;

  const showSocialExchangeToast = useCallback(() => {
    setSignInToast('google');
  }, []);

  const handleSocialExchangeError = useCallback(
    (socialError: unknown) => {
      setFormError(getErrorMessage(socialError, authCopy.login.fallbackError));
      showSocialExchangeToast();
    },
    [showSocialExchangeToast],
  );

  const handleSubmit = useCallback(async () => {
    if (isBusy) {
      return;
    }

    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setFormError(authCopy.login.emailRequired);
      return;
    }

    if (!passwordVisible) {
      setFormError(null);
      setPasswordVisible(true);
      return;
    }

    if (password.length < 8) {
      setFormError(authCopy.login.passwordRequired);
      return;
    }

    setFormError(null);
    setSignInToast(null);
    await mutateAsync();
  }, [email, isBusy, mutateAsync, password, passwordVisible]);

  const handleRetrySocialSignIn = useCallback(() => {
    setSignInToast(null);
    setGoogleRetryNonce((nonce) => nonce + 1);
  }, []);

  const handleAppleSignIn = useCallback(async () => {
    if (isBusy) {
      return;
    }

    setSignInToast(null);
    await signInWithAppleAsync();
  }, [isBusy, signInWithAppleAsync]);

  return (
    <LinearGradient colors={[...loginGradients.dressed]} style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.dressedInner}>
            <View style={styles.hero}>
              <IrlobbyLoginMark />
              <Text style={styles.tagline}>{authCopy.login.subtitle}</Text>
            </View>

            <View style={styles.stack}>
              <Text style={styles.heading}>{authCopy.login.title}</Text>
              {isAppleAvailable ? (
                <AppleSignInButton
                  mode="continue"
                  onPress={handleAppleSignIn}
                  disabled={isBusy}
                  loading={isApplePending}
                />
              ) : null}
              <GoogleSignInButton
                disabled={isBusy}
                label={authCopy.login.googleCta}
                notConfiguredHint={authCopy.login.googleNotConfigured}
                retryNonce={googleRetryNonce}
                onIdToken={async (idToken) => {
                  setFormError(null);
                  setSignInToast(null);
                  await signInWithGoogleAsync(idToken);
                }}
                onError={(googleSignInError) => {
                  handleSocialExchangeError(googleSignInError);
                }}
              />

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>{authCopy.login.orDivider}</Text>
                <View style={styles.orLine} />
              </View>

              <Field
                label="Email"
                hideLabel
                shape="pill"
                leftIcon={
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={18}
                    color={appColors.softInk}
                  />
                }
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder={authCopy.login.emailPlaceholder}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (formError) {
                    setFormError(null);
                  }
                }}
              />
              {passwordVisible ? (
                <Field
                  label="Password"
                  hideLabel
                  shape="pill"
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder={authCopy.login.passwordPlaceholder}
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (formError) {
                      setFormError(null);
                    }
                  }}
                />
              ) : null}

              {formError || authError ? (
                <Text style={styles.errorText}>
                  {formError ??
                    getErrorMessage(authError, authCopy.login.fallbackError)}
                </Text>
              ) : null}

              {config.isUsingFallbackApiBaseUrl ? (
                <Text style={styles.hintText}>
                  Using default backend URL: {config.apiBaseUrl}
                </Text>
              ) : null}

              <SocialAuthButton
                provider="email"
                label={authCopy.login.primaryCta}
                onPress={handleSubmit}
                disabled={isBusy}
                loading={isPending}
                showTrailingIcon={false}
              />

              {passwordVisible ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={authCopy.login.forgotPassword}
                  onPress={() => navigation.navigate('ForgotPassword')}
                  disabled={isBusy}
                  style={styles.forgotWrap}
                >
                  <Text style={styles.forgotText}>{authCopy.login.forgotPassword}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.footer}>
              <LegalConsentText
                variant="footer"
                termsUrl={legal.termsUrl}
                privacyUrl={legal.privacyUrl}
                onOpen={legalSheet.open}
                style={styles.legalText}
                linkStyle={styles.legalLink}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={authCopy.login.footerCta}
                onPress={() => navigation.navigate('Register')}
                disabled={isBusy}
                style={styles.createAccount}
              >
                <Text style={styles.footerPrompt}>
                  {authCopy.login.footerPrompt}{' '}
                  <Text style={styles.legalLink}>{authCopy.login.footerCta}</Text>
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
      <AuthSignInToast
        visible={signInToast !== null}
        title={authCopy.login.signInToastTitle}
        body={
          signInToast === 'google' && formError
            ? formError
            : authCopy.login.signInToastBody
        }
        actionLabel={authCopy.login.signInToastAction}
        onAction={handleRetrySocialSignIn}
      />
      {legalSheet.element}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  dressedInner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: spacing.xl,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  tagline: {
    color: appColors.primary,
    fontFamily: appTypography.bodyMedium,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  heading: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 4,
  },
  stack: {
    gap: 12,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(26, 23, 48, 0.16)',
  },
  orText: {
    color: appColors.mutedInk,
    fontSize: 13,
  },
  errorText: {
    color: appColors.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  hintText: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  forgotWrap: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  forgotText: {
    color: appColors.mutedInk,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  legalText: {
    color: appColors.mutedInk,
    fontSize: 13,
    textAlign: 'center',
  },
  legalLink: {
    color: appColors.ink,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  createAccount: {
    paddingVertical: 4,
  },
  footerPrompt: {
    color: appColors.mutedInk,
    fontSize: 14,
  },
});
