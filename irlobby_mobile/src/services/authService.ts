import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

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

const normalizeUser = (user: AuthUser | (AuthUser & Record<string, unknown>)): AuthUser => ({
  id: user.id,
  email: (user as Record<string, unknown>).email as string,
  firstName:
    (user as Record<string, unknown>).firstName?.toString() ??
    (user as Record<string, unknown>).first_name?.toString(),
  lastName:
    (user as Record<string, unknown>).lastName?.toString() ??
    (user as Record<string, unknown>).last_name?.toString(),
  username: (user as Record<string, unknown>).username?.toString(),
  avatarUrl:
    ((user as Record<string, unknown>).avatarUrl ??
      (user as Record<string, unknown>).avatar_url ??
      null) as string | null,
  bio:
    ((user as Record<string, unknown>).bio ??
      (user as Record<string, unknown>).about ??
      null) as string | null,
  city:
    ((user as Record<string, unknown>).city ??
      (user as Record<string, unknown>).location ??
      null) as string | null,
  interests: Array.isArray((user as Record<string, unknown>).interests)
    ? ((user as Record<string, unknown>).interests as unknown[]).filter(
        (interest): interest is string => typeof interest === 'string',
      )
    : [],
  onboardingCompleted:
    Boolean(
      (user as Record<string, unknown>).onboardingCompleted ??
        (user as Record<string, unknown>).onboarding_completed,
    ),
  isHost:
    Boolean(
      (user as Record<string, unknown>).isHost ??
        (user as Record<string, unknown>).is_host ??
        (user as Record<string, unknown>).host,
    ),
});

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/users/login/', {
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

  const response = await api.post<AuthResponse>('/api/users/register/', requestPayload);
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

  const statusResponse = await api.get<TwitterOAuthStatusResponse>('/api/auth/twitter/status/');
  if (!statusResponse.data?.configured) {
    throw new Error('X/Twitter login is not configured on the backend yet.');
  }

  const oauthUrlResponse = await api.get<TwitterOAuthUrlResponse>('/api/auth/twitter/url/', {
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
    await api.post('/api/auth/logout/');
  } catch (error) {
    console.warn('[authService] Logout request failed', error);
  } finally {
    await authStorage.clearTokens();
  }
}

export async function fetchProfile(): Promise<AuthUser> {
  const response = await api.get<AuthUser>('/api/users/profile/');
  return normalizeUser(response.data);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/api/auth/request-password-reset/', { email });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/api/auth/reset-password/', { token, new_password: password });
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
  await api.patch('/api/users/onboarding/', payload);
}

export async function createInvite(payload: InvitePayload): Promise<InviteResponse> {
  const response = await api.post<InviteResponse>('/api/users/invites/', payload);
  return response.data;
}
