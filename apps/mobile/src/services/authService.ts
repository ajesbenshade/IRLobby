import * as Linking from 'expo-linking';
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
    firstName: userRecord.firstName?.toString() ?? userRecord.first_name?.toString(),
    lastName: userRecord.lastName?.toString() ?? userRecord.last_name?.toString(),
    username: userRecord.username?.toString(),
    avatarUrl: (userRecord.avatarUrl ?? userRecord.avatar_url ?? null) as string | null,
    bio: (userRecord.bio ?? userRecord.about ?? null) as string | null,
    city: (userRecord.city ?? userRecord.location ?? null) as string | null,
    interests: interests.filter((interest): interest is string => typeof interest === 'string'),
    photoAlbum: photoAlbum.filter((photo): photo is string => typeof photo === 'string'),
    onboardingCompleted: Boolean(userRecord.onboardingCompleted ?? userRecord.onboarding_completed),
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
  const returnUrl = config.twitterRedirectUri?.trim() || Linking.createURL('auth/twitter');

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
