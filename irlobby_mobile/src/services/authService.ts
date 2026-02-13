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
