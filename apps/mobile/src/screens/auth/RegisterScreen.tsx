import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { Button, Checkbox, HelperText, Text } from 'react-native-paper';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { View } from '@components/RNCompat';
import { auth as authCopy } from '@constants/copy';
import { useAuth } from '@hooks/useAuth';
import { updateOnboarding } from '@services/authService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

const TERMS_URL = 'https://liyf.app/terms-of-service';
const PRIVACY_URL = 'https://liyf.app/privacy-policy';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen = ({ navigation }: Props) => {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);

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

  const openLegalUrl = (url: string) => {
    void Linking.openURL(url).catch(() => undefined);
  };

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isPending) {
      return;
    }

    await mutateAsync();
  }, [isFormValid, isPending, mutateAsync]);

  return (
    <AuthShell
      eyebrow={authCopy.register.eyebrow}
      title={authCopy.register.title}
      subtitle={authCopy.register.subtitle}
      footer={
        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>{authCopy.register.footerPrompt}</Text>
          <Button mode="text" onPress={() => navigation.navigate('Login')} disabled={isPending} compact>
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
          {error && (
            <HelperText type="error" visible>
              {getErrorMessage(error, authCopy.register.fallbackError)}
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
                <Text style={styles.legalLink} onPress={() => openLegalUrl(PRIVACY_URL)}>
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!isFormValid}
            loading={isPending}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            buttonColor={appColors.primary}
          >
            {authCopy.register.primaryCta}
          </Button>
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
