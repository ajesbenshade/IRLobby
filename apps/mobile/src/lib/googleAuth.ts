import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

import { config } from '@constants/config';
import { getErrorMessage } from '@utils/error';

const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

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
  const iosClientId = trimId(config.googleIosClientId);
  return {
    clientId: webClientId ?? trimId(config.googleExpoClientId),
    iosClientId,
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

export const GOOGLE_INVALID_ID_TOKEN_MESSAGE =
  'Google sign-in returned a token that is not an OpenID identity token. It was not sent to the server.';

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

export function peekGoogleTokenClaims(
  idToken: string,
): { aud?: string; iss?: string; sub?: string } | null {
  const parts = idToken.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }
  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) {
    return null;
  }
  try {
    const claims = JSON.parse(decoded) as {
      aud?: unknown;
      iss?: unknown;
      sub?: unknown;
    };
    const readString = (value: unknown): string | undefined => {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (Array.isArray(value)) {
        const first = value.find(
          (item): item is string => typeof item === 'string' && Boolean(item.trim()),
        );
        return first?.trim();
      }
      return undefined;
    };
    return {
      aud: readString(claims.aud),
      iss: readString(claims.iss),
      sub: readString(claims.sub),
    };
  } catch {
    return null;
  }
}

export function peekGoogleTokenAudience(idToken: string): string | null {
  return peekGoogleTokenClaims(idToken)?.aud ?? null;
}

export function isGoogleIdToken(value: string): boolean {
  const claims = peekGoogleTokenClaims(value);
  if (!claims?.iss || !GOOGLE_ISSUERS.has(claims.iss)) {
    return false;
  }
  return Boolean(claims.aud && claims.sub);
}

const readIdTokenFromUrl = (url?: string | null): string | null => {
  if (!url) {
    return null;
  }
  const hash = url.split('#')[1];
  const query = url.split('?')[1]?.split('#')[0];
  const encoded = hash || query;
  if (!encoded) {
    return null;
  }
  try {
    const params = new URLSearchParams(encoded);
    return readTokenCandidate(params.get('id_token'));
  } catch {
    return null;
  }
};

export function getGoogleIdTokenFromAuthResult(
  result: GoogleAuthPromptResult,
): string | null {
  const candidates = [
    result.params?.id_token,
    result.params?.idToken,
    result.authentication?.idToken,
    result.authentication?.id_token,
    readIdTokenFromUrl(result.url),
  ];
  for (const candidate of candidates) {
    const token = readTokenCandidate(candidate);
    if (token && isGoogleIdToken(token)) {
      return token;
    }
  }
  return null;
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
    if (!idToken || !isGoogleIdToken(idToken)) {
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
    /audience|could not be verified|invalid google|not configured|malformed/i.test(
      base,
    );
  if (audience && looksLikeAudienceFailure && !base.includes(audience)) {
    return new Error(
      `${base} Token audience ${audience} must be listed in backend GOOGLE_OAUTH_CLIENT_IDS.`,
    );
  }
  return new Error(base);
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
      const exchanged = await exchange(options.request, code);
      if (exchanged && !isGoogleIdToken(exchanged)) {
        throw new Error(GOOGLE_INVALID_ID_TOKEN_MESSAGE);
      }
      idToken = isGoogleIdToken(exchanged) ? exchanged : null;
    }
  }

  if (!idToken) {
    throw new Error(describeMissingGoogleIdToken(authResult));
  }

  await onIdToken(idToken);
  return 'signed-in';
}
