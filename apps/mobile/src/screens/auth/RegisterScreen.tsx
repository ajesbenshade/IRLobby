import * as AppleAuthentication from 'expo-apple-authentication';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { AppleSignInButton } from '@components/AppleSignInButton';
import { GoogleSignInButton } from '@components/GoogleSignInButton';
import { View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { DatePickerSheet, PickerField } from '@components/foyer/DatePickerSheet';
import { Field } from '@components/ui/Field';
import { auth as authCopy } from '@constants/copy';
import { useAuth } from '@hooks/useAuth';
import { updateOnboarding } from '@services/authService';
import { appColors } from '@theme/index';
import axios from 'axios';

import { birthDayLimits, formatDayShort, parseIsoDate, toIsoDate, type DayValue } from '@foyer/dates';
import { registrationFieldError } from '@foyer/logic';
import { getErrorMessage } from '@utils/error';
import { refreshAppConfig, useAppConfig } from '@services/appConfig';
import { useLegalSheet } from '@components/foyer/LegalWebViewSheet';
import { LegalConsentText } from '@components/foyer/LegalConsentText';
import { LEGAL_CONSENT_COPY } from '@constants/foyerCopy';

import type { AuthStackParamList } from '@navigation/types';


type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const persistLegalAcceptance = async () => {
  try {
    await updateOnboarding({ terms_accepted: true, privacy_accepted: true });
  } catch {
    // Non-fatal: legal can be re-prompted later.
  }
};

export const RegisterScreen = ({ navigation }: Props) => {
  const legal = useAppConfig();
  const legalSheet = useLegalSheet();
  // Fetch the latest Terms / Privacy links before the person accepts them.
  useEffect(() => {
    void refreshAppConfig({ force: true });
  }, []);
  const {
    signUp,
    signInWithAppleIdentityToken,
    signInWithGoogleIdToken,
  } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [birthPickerOpen, setBirthPickerOpen] = useState(false);
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [socialError, setSocialError] = useState<unknown>(null);

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
        dateOfBirth: dateOfBirth.trim(),
        termsAccepted: acceptedLegal,
      });
      await persistLegalAcceptance();
      return user;
    },
  });

  const {
    mutateAsync: signInWithGoogleAsync,
    isPending: isGooglePending,
    error: googleError,
  } = useMutation({
    mutationFn: async (idToken: string) => {
      const result = await signInWithGoogleIdToken(idToken, { acceptedLegal });
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
        acceptedLegal,
      });
      await persistLegalAcceptance();
      return result;
    },
  });

  const isBusy = isPending || isGooglePending || isApplePending;
  const authError = socialError ?? error ?? googleError ?? appleError;

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isBusy) {
      return;
    }

    await mutateAsync();
  }, [isFormValid, isBusy, mutateAsync]);

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
          <Text style={styles.footerText}>{authCopy.register.footerPrompt}</Text>
          <AppButton
            variant="ghost"
            compact
            onPress={() => navigation.navigate('Login')}
            disabled={isBusy}
          >
            {authCopy.register.footerCta}
          </AppButton>
        </View>
      }
    >
      <AccentPill tone="secondary">Real plans, real fast</AccentPill>

      <View style={styles.form}>
        <Field
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
        />
        <Field
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoComplete="username"
        />
        <PickerField
          label="Birth date"
          value={dateOfBirth && parseIsoDate(dateOfBirth) ? formatDayShort(parseIsoDate(dateOfBirth) as DayValue) : ''}
          placeholder="Choose a date"
          onPress={() => setBirthPickerOpen(true)}
          testID="register-birth-date"
        />
        <DatePickerSheet
          visible={birthPickerOpen}
          mode="birthdate"
          title="Birth date"
          value={parseIsoDate(dateOfBirth)}
          limits={birthDayLimits()}
          onCancel={() => setBirthPickerOpen(false)}
          onDone={(value) => {
            setDateOfBirth(toIsoDate(value));
            setBirthPickerOpen(false);
          }}
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <Field
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          error={
            !passwordsMatch && confirmPassword.length > 0
              ? 'Passwords do not match.'
              : undefined
          }
        />
        {authError ? (
          <Text style={styles.errorText}>
            {(axios.isAxiosError(authError) ? registrationFieldError(authError.response?.data) : null) ||
              getErrorMessage(authError, authCopy.register.fallbackError)}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedLegal }}
          onPress={() => setAcceptedLegal((prev) => !prev)}
          style={styles.legalRow}
        >
          <View style={[styles.checkBox, acceptedLegal ? styles.checkBoxOn : null]}>
            {acceptedLegal ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <LegalConsentText
            variant="checkbox"
            termsUrl={legal.termsUrl}
            privacyUrl={legal.privacyUrl}
            onOpen={legalSheet.open}
            style={styles.legalText}
          />
        </Pressable>

        {!acceptedLegal ? (
          <Text style={styles.hintText}>{LEGAL_CONSENT_COPY.signUpRequired}</Text>
        ) : null}

        <AppButton onPress={handleSubmit} disabled={!isFormValid || isBusy} loading={isPending}>
          {authCopy.register.primaryCta}
        </AppButton>

        <View style={styles.oauthSection}>
          <View style={styles.divider} />
          {isAppleAvailable ? (
            <AppleSignInButton
              mode="signUp"
              height={48}
              onPress={handleAppleSignIn}
              disabled={isBusy || !acceptedLegal}
              loading={isApplePending}
            />
          ) : null}
          <GoogleSignInButton
            disabled={isBusy || !acceptedLegal}
            label={authCopy.register.googleCta}
            notConfiguredHint={authCopy.register.googleNotConfigured}
            onIdToken={async (idToken) => {
              setSocialError(null);
              await signInWithGoogleAsync(idToken);
            }}
            onError={setSocialError}
          />
        </View>
      </View>
      {legalSheet.element}
    </AuthShell>
  );
};

const styles = StyleSheet.create({
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
  oauthSection: {
    marginTop: 4,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: appColors.line,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    minHeight: 48,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.lineStrong,
    backgroundColor: appColors.cardStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    backgroundColor: appColors.primary,
    borderColor: appColors.primary,
  },
  checkMark: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  legalText: {
    flex: 1,
    color: appColors.mutedInk,
    lineHeight: 20,
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
