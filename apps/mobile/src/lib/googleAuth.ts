import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

import { config } from '@constants/config';
import { getErrorMessage } from '@utils/error';

const trimId = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const reverseGoogleIosClientIdScheme = (clientId?: string) => {
  const trimmed = trimId(clientId);
  if (!trimmed?.endsWith('.apps.googleusercontent.com')) {
    return undefined;
  }
  return trimmed.split('.').reverse().join('.');
};

export const getGoogleAuthRequestConfig = () => {
  const webClientId = trimId(config.googleWebClientId);
  return {
    clientId: webClientId ?? trimId(config.googleExpoClientId),
    iosClientId: trimId(config.googleIosClientId),
    androidClientId: trimId(config.googleAndroidClientId),
    webClientId,
    scopes: ['openid', 'profile', 'email'] as string[],
    selectAccount: true,
    shouldAutoExchangeCode: false,
  };
};

export const getGoogleNativeRedirectUriOptions = () => {
  if (Platform.OS === 'ios') {
    const reversed = reverseGoogleIosClientIdScheme(config.googleIosClientId);
    if (reversed) {
      return { native: `${reversed}:/oauthredirect` };
    }
  }
  return undefined;
};

export const isGoogleAuthReadyForPlatform = () => {
  const ids = getGoogleAuthRequestConfig();
  const hasWebClientId = Boolean(ids.webClientId);
  if (Platform.OS === 'ios') {
    return Boolean(ids.iosClientId && hasWebClientId);
  }
  if (Platform.OS === 'android') {
    return Boolean(ids.androidClientId && hasWebClientId);
  }
  return hasWebClientId || Boolean(ids.clientId);
};

export const GOOGLE_MISSING_ID_TOKEN_MESSAGE =
  'Google sign-in did not return an identity token. Confirm EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is baked into this build.';

export type GoogleAuthPromptResult = {
  type: string;
  params?: Record<string, string | undefined> | null;
  authentication?: {
    idToken?: string | null;
    id_token?: string | null;
  } | null;
  errorCode?: string | null;
  error?: { message?: string } | string | null;
  url?: string | null;
};

export type GoogleAuthRequestLike = {
  clientId?: string | null;
  redirectUri?: string | null;
  codeVerifier?: string | null;
};

export type GoogleCodeExchanger = (
  request: GoogleAuthRequestLike,
  code: string,
) => Promise<string>;

const readTokenCandidate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const decodeBase64Url = (value: string): string | null => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(padded);
    }
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
};

export function peekGoogleTokenAudience(idToken: string): string | null {
  const payload = idToken.split('.')[1];
  if (!payload) {
    return null;
  }
  const decoded = decodeBase64Url(payload);
  if (!decoded) {
    return null;
  }
  try {
    const claims = JSON.parse(decoded) as { aud?: unknown };
    if (typeof claims.aud === 'string' && claims.aud.trim()) {
      return claims.aud.trim();
    }
    if (Array.isArray(claims.aud)) {
      const first = claims.aud.find(
        (value): value is string => typeof value === 'string' && Boolean(value.trim()),
      );
      return first?.trim() ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export function getGoogleIdTokenFromAuthResult(
  result: GoogleAuthPromptResult,
): string | null {
  return (
    readTokenCandidate(result.params?.id_token) ??
    readTokenCandidate(result.params?.idToken) ??
    readTokenCandidate(result.authentication?.idToken) ??
    readTokenCandidate(result.authentication?.id_token)
  );
}

export function describeMissingGoogleIdToken(
  result: GoogleAuthPromptResult,
): string {
  const hasCode = Boolean(readTokenCandidate(result.params?.code));
  if (hasCode) {
    return 'Google authorized, but the identity-token exchange failed. Confirm EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is in this build, then add that ID plus the iOS/Android client IDs to backend GOOGLE_OAUTH_CLIENT_IDS.';
  }
  const paramKeys = result.params ? Object.keys(result.params).join(', ') : '';
  if (paramKeys) {
    return `${GOOGLE_MISSING_ID_TOKEN_MESSAGE} Response params: ${paramKeys}.`;
  }
  return GOOGLE_MISSING_ID_TOKEN_MESSAGE;
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

export async function exchangeGoogleAuthorizationCode(
  request: GoogleAuthRequestLike,
  code: string,
): Promise<string> {
  const clientId = trimId(request.clientId ?? undefined);
  const redirectUri = trimId(request.redirectUri ?? undefined);
  if (!clientId || !redirectUri) {
    throw new Error(
      'Google sign-in could not exchange the authorization code (missing client ID or redirect URI).',
    );
  }

  try {
    const tokens = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code,
        redirectUri,
        extraParams: request.codeVerifier
          ? { code_verifier: request.codeVerifier }
          : {},
      },
      { tokenEndpoint: 'https://oauth2.googleapis.com/token' },
    );
    const idToken = readTokenCandidate(tokens.idToken);
    if (!idToken) {
      throw new Error(
        'Google token exchange succeeded without an identity token. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID on this EAS build.',
      );
    }
    return idToken;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('identity token') ||
        error.message.includes('authorization code'))
    ) {
      throw error;
    }
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'token exchange failed';
    throw new Error(`Google identity token exchange failed: ${detail}`);
  }
}

export function wrapGoogleExchangeError(error: unknown, idToken: string): Error {
  const base = getErrorMessage(error, 'Google sign-in could not be completed.');
  const audience = peekGoogleTokenAudience(idToken);
  const looksLikeAudienceFailure =
    /audience|verified|invalid google|not configured|identity token/i.test(base);
  if (audience && looksLikeAudienceFailure && !base.includes(audience)) {
    return new Error(
      `${base} Token audience ${audience} must be listed in backend GOOGLE_OAUTH_CLIENT_IDS.`,
    );
  }
  return error instanceof Error ? error : new Error(base);
}

export function unwrapGoogleAuthPayload(data: unknown): Record<string, unknown> {
  let payload: unknown = data;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) {
      throw new Error('Google sign-in did not return authentication data.');
    }
    try {
      payload = JSON.parse(trimmed) as unknown;
    } catch {
      throw new Error('Google sign-in did not return authentication data.');
    }
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Google sign-in did not return authentication data.');
  }
  const record = payload as Record<string, unknown>;
  if (!record.user && record.data && typeof record.data === 'object') {
    return unwrapGoogleAuthPayload(record.data);
  }
  return record;
}

export async function completeGoogleAuthPrompt(
  promptAsync: () => Promise<GoogleAuthPromptResult>,
  onIdToken: (idToken: string) => Promise<unknown>,
  options?: {
    request?: GoogleAuthRequestLike | null;
    exchangeCode?: GoogleCodeExchanger;
  },
): Promise<'cancelled' | 'signed-in'> {
  const authResult = await promptAsync();

  if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
    return 'cancelled';
  }

  if (authResult.type !== 'success') {
    throw new Error(googlePromptErrorMessage(authResult));
  }

  let idToken = getGoogleIdTokenFromAuthResult(authResult);
  if (!idToken) {
    const code = readTokenCandidate(authResult.params?.code);
    if (code && options?.request) {
      const exchange = options.exchangeCode ?? exchangeGoogleAuthorizationCode;
      idToken = await exchange(options.request, code);
    }
  }

  if (!idToken) {
    throw new Error(describeMissingGoogleIdToken(authResult));
  }

  await onIdToken(idToken);
  return 'signed-in';
}
