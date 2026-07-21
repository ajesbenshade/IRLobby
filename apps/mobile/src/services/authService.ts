import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { API_ROUTES } from '@shared/schema';

import { config } from '@constants/config';

import { api } from './apiClient';
import { authStorage } from './authStorage';

import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from '../types/auth';

WebBrowser.maybeCompleteAuthSession();

const normalizeTokens = (tokens: Partial<AuthTokens> | null | undefined): AuthTokens => {
  const accessToken =
    (typeof tokens?.accessToken === 'string' && tokens.accessToken) ||
    (typeof tokens?.access === 'string' && tokens.access) ||
    '';

  if (!accessToken) {
    throw new Error('Auth tokens response missing access token');
  }

  return {
    accessToken,
    refreshToken: tokens?.refreshToken ?? tokens?.refresh,
    access: tokens?.access,
    refresh: tokens?.refresh,
    expiresIn: tokens?.expiresIn,
  };
};

const normalizeUser = (user: AuthUser | (AuthUser & Record<string, unknown>)): AuthUser => {
  const userRecord = user as Record<string, unknown>;
  const preferences = userRecord.preferences as Record<string, unknown> | undefined;
  const activityPreferences =
    (userRecord.activityPreferences as Record<string, unknown> | undefined) ||
    (preferences?.activity_preferences as Record<string, unknown> | undefined) ||
    {};
  const notificationPreferences =
    (preferences?.notifications as Record<string, unknown> | undefined) || {};

  const interests = Array.isArray(userRecord.interests)
    ? (userRecord.interests as unknown[])
    : Array.isArray(preferences?.interests)
      ? (preferences?.interests as unknown[])
      : [];

  const photoAlbum = Array.isArray(userRecord.photoAlbum)
    ? (userRecord.photoAlbum as unknown[])
    : Array.isArray(preferences?.photo_album)
      ? (preferences?.photo_album as unknown[])
      : [];

  return {
    id: user.id,
    email: userRecord.email as string,
    preferences,
    firstName: userRecord.firstName?.toString() ?? userRecord.first_name?.toString(),
    lastName: userRecord.lastName?.toString() ?? userRecord.last_name?.toString(),
    username: userRecord.username?.toString(),
    avatarUrl: (userRecord.avatarUrl ?? userRecord.avatar_url ?? null) as string | null,
    bio: (userRecord.bio ?? userRecord.about ?? null) as string | null,
    city: (userRecord.city ?? userRecord.location ?? null) as string | null,
    interests: interests.filter((interest): interest is string => typeof interest === 'string'),
    ageRange: (userRecord.ageRange ?? preferences?.age_range ?? null) as string | null,
    activityPreferences,
    photoAlbum: photoAlbum.filter((photo): photo is string => typeof photo === 'string'),
    onboardingCompleted: Boolean(userRecord.onboardingCompleted ?? userRecord.onboarding_completed),
    termsAccepted: Boolean(userRecord.termsAccepted ?? userRecord.terms_accepted),
    privacyAccepted: Boolean(userRecord.privacyAccepted ?? userRecord.privacy_accepted),
    legalAccepted: Boolean(userRecord.legalAccepted ?? userRecord.legal_accepted),
    termsAcceptedAt: (userRecord.termsAcceptedAt ?? userRecord.terms_accepted_at ?? null) as string | null,
    privacyAcceptedAt: (userRecord.privacyAcceptedAt ?? userRecord.privacy_accepted_at ?? null) as string | null,
    pushNotificationsEnabled: Boolean(notificationPreferences.pushNotifications),
    isHost: Boolean(userRecord.isHost ?? userRecord.is_host ?? userRecord.host),
  };
};

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(API_ROUTES.USER_LOGIN, {
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  });
  const normalizedTokens = normalizeTokens(response.data.tokens);
  await authStorage.setTokens(normalizedTokens);
  return { user: normalizeUser(response.data.user), tokens: normalizedTokens };
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const requestPayload = {
    username:
      payload.username?.trim() ||
      payload.email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30),
    email: payload.email,
    password: payload.password,
    password_confirm: payload.password,
    first_name: payload.firstName,
    last_name: payload.lastName,
  };

  const response = await api.post<AuthResponse>(API_ROUTES.USER_REGISTER, requestPayload);
  const normalizedTokens = normalizeTokens(response.data.tokens);
  await authStorage.setTokens(normalizedTokens);
  return { user: normalizeUser(response.data.user), tokens: normalizedTokens };
}

interface TwitterOAuthUrlResponse {
  auth_url: string;
  state?: string;
}

interface TwitterOAuthStatusResponse {
  configured?: boolean;
}

const parseCallbackUser = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Twitter sign-in response is missing user details.');
  }

  try {
    return JSON.parse(value) as AuthUser;
  } catch (error) {
    throw new Error('Twitter sign-in response was not valid.');
  }
};

export async function loginWithTwitter(): Promise<AuthResponse> {
  const configuredRedirect = config.twitterRedirectUri?.trim();
  const returnUrl =
    configuredRedirect && configuredRedirect.startsWith('irlobby://')
      ? configuredRedirect
      : 'irlobby://auth/twitter';

  const statusResponse = await api.get<TwitterOAuthStatusResponse>(API_ROUTES.AUTH_TWITTER_STATUS);
  if (!statusResponse.data?.configured) {
    throw new Error('X/Twitter login is not configured on the backend yet.');
  }

  const oauthUrlResponse = await api.get<TwitterOAuthUrlResponse>(API_ROUTES.AUTH_TWITTER_URL, {
    params: {
      mobile_redirect_uri: returnUrl,
    },
  });

  const authUrl = oauthUrlResponse.data?.auth_url;
  if (!authUrl) {
    throw new Error('Unable to start X/Twitter login. Please try again.');
  }

  const authResult = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
  if (authResult.type !== 'success' || !authResult.url) {
    throw new Error('X/Twitter sign-in was cancelled.');
  }

  const parsedResult = Linking.parse(authResult.url);
  const callbackParams = parsedResult.queryParams ?? {};

  if (typeof callbackParams.error === 'string' && callbackParams.error.length > 0) {
    throw new Error(callbackParams.error);
  }

  const accessTokenValue = callbackParams.access;
  const refreshTokenValue = callbackParams.refresh;
  const userValue = callbackParams.user;

  if (typeof accessTokenValue !== 'string' || !accessTokenValue) {
    throw new Error('X/Twitter sign-in did not return an access token.');
  }

  const normalizedTokens = normalizeTokens({
    access: accessTokenValue,
    refresh: typeof refreshTokenValue === 'string' ? refreshTokenValue : undefined,
  });

  await authStorage.setTokens(normalizedTokens);

  return {
    user: normalizeUser(parseCallbackUser(userValue)),
    tokens: normalizedTokens,
  };
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (error) {
    console.warn('[authService] Apple sign-in availability check failed', error);
    return false;
  }
}

export async function loginWithApple(): Promise<AuthResponse> {
  if (!(await isAppleSignInAvailable())) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'ERR_REQUEST_CANCELED') {
      throw new Error('Apple sign-in was cancelled.');
    }
    throw error;
  }

  if (!credential.identityToken) {
    throw new Error('Apple sign-in did not return an identity token.');
  }

  const response = await api.post<AuthResponse>(API_ROUTES.AUTH_APPLE_SIGNIN, {
    identity_token: credential.identityToken,
    email: credential.email ?? undefined,
    full_name: credential.fullName
      ? {
          givenName: credential.fullName.givenName ?? undefined,
          familyName: credential.fullName.familyName ?? undefined,
        }
      : undefined,
  });

  const normalizedTokens = normalizeTokens(response.data.tokens);
  await authStorage.setTokens(normalizedTokens);

  return {
    user: normalizeUser(response.data.user),
    tokens: normalizedTokens,
  };
}

const getGoogleClientIdForPlatform = (): string | undefined => {
  if (Platform.OS === 'ios') {
    return config.googleIosClientId?.trim() || config.googleWebClientId?.trim();
  }
  if (Platform.OS === 'android') {
    return config.googleAndroidClientId?.trim() || config.googleWebClientId?.trim();
  }
  return config.googleWebClientId?.trim();
};

const getGoogleReversedClientIdScheme = (clientId: string): string | null => {
  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    return null;
  }
  return clientId.split('.').reverse().join('.');
};

const createGoogleNonce = async (): Promise<string> => {
  const randomBytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export async function isGoogleSignInConfigured(): Promise<boolean> {
  return Boolean(getGoogleClientIdForPlatform());
}

export async function loginWithGoogle(): Promise<AuthResponse> {
  const clientId = getGoogleClientIdForPlatform();
  if (!clientId) {
    throw new Error('Google sign-in is not configured in the app yet.');
  }

  const statusResponse = await api.get<{ configured?: boolean }>(API_ROUTES.AUTH_GOOGLE_STATUS);
  if (!statusResponse.data?.configured) {
    throw new Error('Google sign-in is not configured on the backend yet.');
  }

  const reversedScheme = getGoogleReversedClientIdScheme(clientId);
  const redirectUri =
    Platform.OS === 'ios' && reversedScheme
      ? `${reversedScheme}:/oauthredirect`
      : AuthSession.makeRedirectUri({
          scheme: 'irlobby',
          path: 'auth/google',
        });

  const nonce = await createGoogleNonce();
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
    usePKCE: false,
    extraParams: {
      nonce,
    },
  });

  const authResult = await request.promptAsync({
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  });

  if (authResult.type !== 'success') {
    throw new Error('Google sign-in was cancelled.');
  }

  const identityToken =
    (typeof authResult.params.id_token === 'string' && authResult.params.id_token) ||
    (typeof authResult.authentication?.idToken === 'string' && authResult.authentication.idToken) ||
    '';

  if (!identityToken) {
    throw new Error('Google sign-in did not return an identity token.');
  }

  const response = await api.post<AuthResponse>(API_ROUTES.AUTH_GOOGLE_SIGNIN, {
    identity_token: identityToken,
  });

  const normalizedTokens = normalizeTokens(response.data.tokens);
  await authStorage.setTokens(normalizedTokens);

  return {
    user: normalizeUser(response.data.user),
    tokens: normalizedTokens,
  };
}

export async function logout(): Promise<void> {
  try {
    await api.post(API_ROUTES.AUTH_LOGOUT);
  } catch (error) {
    console.warn('[authService] Logout request failed', error);
  } finally {
    await authStorage.clearTokens();
  }
}

export async function fetchProfile(): Promise<AuthUser> {
  const response = await api.get<AuthUser>(API_ROUTES.USER_PROFILE);
  return normalizeUser(response.data);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post(API_ROUTES.AUTH_REQUEST_PASSWORD_RESET, { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post(API_ROUTES.AUTH_RESET_PASSWORD, { token, new_password: password });
}

export interface OnboardingPayload {
  bio?: string;
  city?: string;
  age_range?: string;
  interests?: string[];
  activity_preferences?: Record<string, unknown>;
  avatar_url?: string;
  photo_album?: string[];
  terms_accepted?: boolean;
  privacy_accepted?: boolean;
  onboarding_completed?: boolean;
}

export interface InvitePayload {
  contact_name?: string;
  contact_value: string;
  channel: 'sms' | 'email';
}

export interface InviteResponse {
  token: string;
  status: 'pending' | 'accepted';
  channel: 'sms' | 'email';
  contact_value: string;
}

export async function updateOnboarding(payload: OnboardingPayload): Promise<void> {
  await api.patch(API_ROUTES.USER_ONBOARDING, payload);
}

export async function createInvite(payload: InvitePayload): Promise<InviteResponse> {
  const response = await api.post<InviteResponse>(API_ROUTES.USER_INVITES, payload);
  return response.data;
}
