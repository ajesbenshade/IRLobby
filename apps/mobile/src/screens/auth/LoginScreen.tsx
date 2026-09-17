import * as AppleAuthentication from 'expo-apple-authentication';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleSignInButton } from '@components/GoogleSignInButton';
import { IrlobbyLoginMark } from '@components/IrlobbyLoginMark';
import { View } from '@components/RNCompat';
import { SocialAuthButton } from '@components/SocialAuthButton';
import { Field } from '@components/ui/Field';
import { config } from '@constants/config';
import { auth as authCopy } from '@constants/copy';
import { useAuth } from '@hooks/useAuth';
import { appColors, appTypography, loginGradients, radii, spacing } from '@theme/index';
import { getErrorMessage } from '@utils/error';
import { isAllowedIrlobbyUrl } from '@utils/safeUrl';

import type { AuthStackParamList } from '@navigation/types';

const TERMS_URL = 'https://irlobby.com/terms-of-service';
const PRIVACY_URL = 'https://irlobby.com/privacy-policy';
const EMAIL_PATTERN = /\S+@\S+\.\S+/;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const openLegalUrl = (url: string) => {
  if (!isAllowedIrlobbyUrl(url)) {
    return;
  }
  void Linking.openURL(url).catch(() => undefined);
};

export const LoginScreen = ({ navigation }: Props) => {
  const {
    signIn,
    signInWithAppleIdentityToken,
    signInWithGoogleIdToken,
    signInWithTwitter,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

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
    mutationFn: (idToken: string) => signInWithGoogleIdToken(idToken),
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
    await mutateAsync();
  }, [email, isBusy, mutateAsync, password, passwordVisible]);

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

  if (isTwitterPending) {
    return (
      <LinearGradient colors={[...loginGradients.twitterProgress]} style={styles.root}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.progressInner}>
            <Text style={styles.progressEyebrow}>{authCopy.login.eyebrow}</Text>
            <View style={styles.progressMark}>
              <View style={styles.smiley}>
                <Text style={styles.smileyFace}>☺</Text>
              </View>
              <IrlobbyLoginMark inverted />
              <Text style={styles.progressLockup}>Meet in real life</Text>
            </View>
            <View style={styles.progressCard}>
              <View style={styles.progressCopy}>
                <Text style={styles.progressTitle}>{authCopy.login.twitterProgressTitle}</Text>
                <Text style={styles.progressBody}>{authCopy.login.twitterProgressBody}</Text>
              </View>
              <SocialAuthButton
                provider="x"
                label={authCopy.login.twitterCta}
                loading
                keepLabelWhileLoading
                appearance="onLight"
                style={styles.progressCta}
              />
            </View>
            <View style={styles.progressNoteRow}>
              <MaterialCommunityIcons name="lock-outline" size={14} color="rgba(255,255,255,0.86)" />
              <Text style={styles.progressNote}>{authCopy.login.twitterProgressNote}</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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
              {isAppleAvailable ? (
                <SocialAuthButton
                  provider="apple"
                  label={authCopy.login.appleCta}
                  onPress={handleAppleSignIn}
                  disabled={isBusy}
                  loading={isApplePending}
                />
              ) : null}
              <GoogleSignInButton
                disabled={isBusy}
                label={authCopy.login.googleCta}
                notConfiguredHint={authCopy.login.googleNotConfigured}
                onIdToken={(idToken) => signInWithGoogleAsync(idToken)}
              />
              <SocialAuthButton
                provider="x"
                label={authCopy.login.twitterCta}
                onPress={handleTwitterSignIn}
                disabled={isBusy}
                loading={isTwitterPending}
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
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={authCopy.login.forgotPassword}
                onPress={() => navigation.navigate('ForgotPassword')}
                disabled={isBusy}
                style={styles.forgotWrap}
              >
                <Text style={styles.forgotText}>{authCopy.login.forgotPassword}</Text>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.legalText}>
                {authCopy.login.legalPrefix}{' '}
                <Text style={styles.legalLink} onPress={() => openLegalUrl(TERMS_URL)}>
                  {authCopy.login.legalTerms}
                </Text>
                {' & '}
                <Text style={styles.legalLink} onPress={() => openLegalUrl(PRIVACY_URL)}>
                  {authCopy.login.legalPrivacy}
                </Text>
              </Text>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  tagline: {
    color: appColors.mutedInk,
    fontFamily: appTypography.bodyMedium,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
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
  progressInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  progressEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  progressMark: {
    alignItems: 'center',
    gap: spacing.md,
  },
  smiley: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smileyFace: {
    fontSize: 28,
    color: appColors.primary,
  },
  progressLockup: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  progressCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(255, 248, 244, 0.94)',
    borderRadius: radii.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressCopy: {
    flex: 1,
    gap: 6,
  },
  progressTitle: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  progressBody: {
    color: appColors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
  },
  progressCta: {
    minWidth: 168,
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.ink,
  },
  progressNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressNote: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
  },
});
