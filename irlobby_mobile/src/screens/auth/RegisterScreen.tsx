import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { getErrorMessage } from '@utils/error';

import type { AuthStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export const RegisterScreen = ({ navigation }: Props) => {
  const theme = useTheme();
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Surface elevation={2} style={styles.card}>
        <Text variant="headlineMedium" style={styles.title}>
          Join IRLobby
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Create an account to host and discover real-world activities.
        </Text>

        <View style={styles.form}>
          <TextInput
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            style={styles.input}
          />
          <TextInput
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            style={styles.input}
          />
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
          />
          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="username"
            style={styles.input}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
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
          >
            Create account
          </Button>
        </View>

        <View style={styles.footer}>
          <Text variant="bodyMedium">Already have an account?</Text>
          <Button mode="text" onPress={() => navigation.navigate('Login')} disabled={isPending}>
            Sign in
          </Button>
        </View>
      </Surface>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748b',
  },
  form: {
    gap: 12,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'transparent',
  },
  submitButton: {
    marginTop: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 16,
  },
});
