import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { AccentPill, AuthShell } from '@components/AppChrome';
import { useAuth } from '@hooks/useAuth';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen = ({ navigation }: Props) => {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordsMatch = password.length >= 8 && password === confirmPassword;

  const isFormValid = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      username.trim().length >= 3 &&
      passwordsMatch,
    [email, firstName, lastName, passwordsMatch, username],
  );

  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: () =>
      signUp({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim(),
        password,
      }),
  });

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || isPending) {
      return;
    }

    await mutateAsync();
  }, [isFormValid, isPending, mutateAsync]);

  return (
    <AuthShell
      eyebrow="New account"
      title="Build a social life with intent."
      subtitle="Create your profile, host something worth showing up for, and discover people who want the same kind of offline energy."
      footer={
        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>Already have an account?</Text>
          <Button mode="text" onPress={() => navigation.navigate('Login')} disabled={isPending} compact>
            Sign in
          </Button>
        </View>
      }
    >
      <AccentPill tone="secondary">Host, discover, match</AccentPill>

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
              {getErrorMessage(error, 'Registration failed. Please try again.')}
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!isFormValid}
            loading={isPending}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            buttonColor={appColors.primary}
          >
            Create account
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
