import { Platform } from 'react-native';

import { config } from '@constants/config';

const trimId = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const getGoogleAuthRequestConfig = () => ({
  clientId: trimId(config.googleExpoClientId),
  iosClientId: trimId(config.googleIosClientId),
  androidClientId: trimId(config.googleAndroidClientId),
  webClientId: trimId(config.googleWebClientId),
  scopes: ['profile', 'email'] as string[],
  selectAccount: true,
});

export const isGoogleAuthReadyForPlatform = () => {
  const ids = getGoogleAuthRequestConfig();
  if (Platform.OS === 'ios') {
    return Boolean(ids.iosClientId);
  }
  if (Platform.OS === 'android') {
    return Boolean(ids.androidClientId);
  }
  return Boolean(ids.webClientId || ids.clientId);
};

export const GOOGLE_MISSING_ID_TOKEN_MESSAGE =
  'Google sign-in did not return an identity token.';

export type GoogleAuthPromptResult = {
  type: string;
  params?: Record<string, string | undefined> | null;
  authentication?: { idToken?: string | null } | null;
  errorCode?: string | null;
  error?: { message?: string } | string | null;
};

const readTokenCandidate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export function getGoogleIdTokenFromAuthResult(
  result: GoogleAuthPromptResult,
): string | null {
  return (
    readTokenCandidate(result.params?.id_token) ??
    readTokenCandidate(result.authentication?.idToken)
  );
}

const googlePromptErrorMessage = (result: GoogleAuthPromptResult): string => {
  if (typeof result.error === 'string' && result.error.trim()) {
    return result.error.trim();
  }
  if (
    result.error &&
    typeof result.error === 'object' &&
    typeof result.error.message === 'string' &&
    result.error.message.trim()
  ) {
    return result.error.message.trim();
  }
  if (typeof result.errorCode === 'string' && result.errorCode.trim()) {
    return result.errorCode.trim();
  }
  return 'Google sign-in was interrupted.';
};

export async function completeGoogleAuthPrompt(
  promptAsync: () => Promise<GoogleAuthPromptResult>,
  onIdToken: (idToken: string) => Promise<unknown>,
): Promise<'cancelled' | 'signed-in'> {
  const authResult = await promptAsync();

  if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
    return 'cancelled';
  }

  if (authResult.type !== 'success') {
    throw new Error(googlePromptErrorMessage(authResult));
  }

  const idToken = getGoogleIdTokenFromAuthResult(authResult);
  if (!idToken) {
    throw new Error(GOOGLE_MISSING_ID_TOKEN_MESSAGE);
  }

  await onIdToken(idToken);
  return 'signed-in';
}
