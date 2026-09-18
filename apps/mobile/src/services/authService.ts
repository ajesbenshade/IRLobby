import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_ROUTES } from '@shared/schema';

import {
  getTwitterMobileRedirectUri,
  isTwitterAuthCallbackUrl,
  parseTwitterAuthCallbackUrl,
  TWITTER_CANCELLED_MESSAGE,
  TWITTER_NO_CALLBACK_MESSAGE,
} from '@lib/twitterAuth';
import {
  GOOGLE_MISSING_ID_TOKEN_MESSAGE,
  unwrapGoogleAuthPayload,
  wrapGoogleExchangeError,
} from '@lib/googleAuth';
import { isAllowedTwitterOAuthUrl } from '@utils/safeUrl';

import { api } from './apiClient';
import { authStorage } from './authStorage';

import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginPayload,
  ReliabilitySummary,
  RegisterPayload,
} from '../types/auth';

WebBrowser.maybeCompleteAuthSession();

const asNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeReliability = (
  value: unknown
): ReliabilitySummary | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  return {
    score: asNumberOrNull(source.score),
    label: typeof source.label === 'string' ? source.label : 'New profile',
    reviewCount: asNumberOrNull(source.reviewCount) ?? 0,
    averageRating: asNumberOrNull(source.averageRating),
    ticketValidationRate: asNumberOrNull(source.ticketValidationRate),
    successfulTicketValidations:
      asNumberOrNull(source.successfulTicketValidations) ?? 0,
    ticketValidationCount: asNumberOrNull(source.ticketValidationCount) ?? 0,
  };
};

const normalizeTokens = (
  tokens: Partial<AuthTokens> | null | undefined
): AuthTokens => {
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

const normalizeUser = (
  user: AuthUser | (AuthUser & Record<string, unknown>)
): AuthUser => {
  const userRecord = user as Record<string, unknown>;
  const preferences = userRecord.preferences as
    | Record<string, unknown>
    | undefined;
  const activityPreferences =
    (userRecord.activityPreferences as Record<string, unknown> | undefined) ||
    (preferences?.activity_preferences as
      | Record<string, unknown>
      | undefined) ||
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

  const vibeSource =
    (activityPreferences?.vibe as Record<string, unknown> | undefined) ||
    (preferences?.vibe as Record<string, unknown> | undefined) ||
    null;
  const vibe = vibeSource
    ? {
        vibeProfile:
          typeof vibeSource.vibeProfile === 'string'
            ? (vibeSource.vibeProfile as string)
            : undefined,
        vibeTags: Array.isArray(vibeSource.vibeTags)
          ? (vibeSource.vibeTags as unknown[]).filter(
              (tag): tag is string => typeof tag === 'string'
            )
          : undefined,
        vibeDiscoverTags: Array.isArray(vibeSource.vibeDiscoverTags)
          ? (vibeSource.vibeDiscoverTags as unknown[]).filter(
              (tag): tag is string => typeof tag === 'string'
            )
          : undefined,
        vibeAnswers:
          vibeSource.vibeAnswers && typeof vibeSource.vibeAnswers === 'object'
            ? (vibeSource.vibeAnswers as Record<string, unknown>)
            : undefined,
        vibeCompletedAt:
          typeof vibeSource.vibeCompletedAt === 'string'
            ? (vibeSource.vibeCompletedAt as string)
            : undefined,
        vibeQuizSkipped: Boolean(vibeSource.vibeQuizSkipped),
      }
    : undefined;

  return {
    id: user.id,
    email: userRecord.email as string,
    preferences,
    firstName:
      userRecord.firstName?.toString() ?? userRecord.first_name?.toString(),
    lastName:
      userRecord.lastName?.toString() ?? userRecord.last_name?.toString(),
    username: userRecord.username?.toString(),
    avatarUrl: (userRecord.avatarUrl ?? userRecord.avatar_url ?? null) as
      | string
      | null,
    bio: (userRecord.bio ?? userRecord.about ?? null) as string | null,
    city: (userRecord.city ?? userRecord.location ?? null) as string | null,
    interests: interests.filter(
      (interest): interest is string => typeof interest === 'string'
    ),
    ageRange: (userRecord.ageRange ?? preferences?.age_range ?? null) as
      | string
      | null,
    activityPreferences,
    photoAlbum: photoAlbum.filter(
      (photo): photo is string => typeof photo === 'string'
    ),
    onboardingCompleted: Boolean(
      userRecord.onboardingCompleted ?? userRecord.onboarding_completed
    ),
    termsAccepted: Boolean(
      userRecord.termsAccepted ?? userRecord.terms_accepted
    ),
    privacyAccepted: Boolean(
      userRecord.privacyAccepted ?? userRecord.privacy_accepted
    ),
    legalAccepted: Boolean(
      userRecord.legalAccepted ?? userRecord.legal_accepted
    ),
    termsAcceptedAt: (userRecord.termsAcceptedAt ??
      userRecord.terms_accepted_at ??
      null) as string | null,
    privacyAcceptedAt: (userRecord.privacyAcceptedAt ??
      userRecord.privacy_accepted_at ??
      null) as string | null,
    swipesRemainingToday: asNumberOrNull(
      userRecord.swipesRemainingToday ?? userRecord.swipes_remaining_today
    ),
    pushNotificationsEnabled: Boolean(
      notificationPreferences.pushNotifications
    ),
    isHost: Boolean(userRecord.isHost ?? userRecord.is_host ?? userRecord.host),
    vibe,
    reliability: normalizeReliability(userRecord.reliability),
    stripeConnectAccountId: (userRecord.stripeConnectAccountId ??
      userRecord.stripe_connect_account_id ??
      null) as string | null,
    stripeConnectPayoutsEnabled: Boolean(
      userRecord.stripeConnectPayoutsEnabled ??
        userRecord.stripe_connect_payouts_enabled
    ),
    stripeConnectDetailsSubmitted: Boolean(
      userRecord.stripeConnectDetailsSubmitted ??
        userRecord.stripe_connect_details_submitted
    ),
    canSellTickets: Boolean(
      userRecord.canSellTickets ?? userRecord.can_sell_tickets
    ),
  };
};

const resolveAuthResponsePayload = (
  data: AuthResponse | Record<string, unknown> | null | undefined
): AuthResponse => {
  if (!data || typeof data !== 'object') {
    throw new Error('Auth response missing authentication data');
  }

  const record = data as AuthResponse & Record<string, unknown>;
  const tokenBag =
    record.tokens && typeof record.tokens === 'object'
      ? (record.tokens as Partial<AuthTokens>)
      : {};

  const normalizedTokens = normalizeTokens({
    accessToken:
      typeof tokenBag.accessToken === 'string' ? tokenBag.accessToken : undefined,
    refreshToken:
      typeof tokenBag.refreshToken === 'string' ? tokenBag.refreshToken : undefined,
    access:
      (typeof tokenBag.access === 'string' && tokenBag.access) ||
      (typeof record.access === 'string' && record.access) ||
      undefined,
    refresh:
      (typeof tokenBag.refresh === 'string' && tokenBag.refresh) ||
      (typeof record.refresh === 'string' && record.refresh) ||
      undefined,
    expiresIn: tokenBag.expiresIn,
  });

  if (!record.user || typeof record.user !== 'object') {
    throw new Error('Auth response missing user');
  }

  const normalizedUser = normalizeUser(record.user as AuthUser);
  if (
    normalizedUser.id === undefined ||
    normalizedUser.id === null ||
    normalizedUser.id === ''
  ) {
    throw new Error('Auth response missing user id');
  }

  return { user: normalizedUser, tokens: normalizedTokens };
};

const persistAuthResponse = async (
  response: AuthResponse
): Promise<AuthResponse> => {
  const normalized = resolveAuthResponsePayload(response);
  await authStorage.setTokens(normalized.tokens);
  return normalized;
};

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(API_ROUTES.USER_LOGIN, {
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  });
  return persistAuthResponse(response.data);
}

export async function register(
  payload: RegisterPayload
): Promise<AuthResponse> {
  const requestPayload = {
    username:
      payload.username?.trim() ||
      payload.email
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_.-]/g, '')
        .slice(0, 30),
    email: payload.email,
    password: payload.password,
    password_confirm: payload.password,
    first_name: payload.firstName,
    last_name: payload.lastName,
  };

  const response = await api.post<AuthResponse>(
    API_ROUTES.USER_REGISTER,
    requestPayload
  );
  return persistAuthResponse(response.data);
}

interface TwitterOAuthUrlResponse {
  auth_url: string;
  state?: string;
}

interface TwitterOAuthStatusResponse {
  configured?: boolean;
}

type TwitterSessionOutcome =
  | { source: 'url'; url: string }
  | { source: 'cancel' }
  | { source: 'dismiss' }
  | { source: 'error'; message: string };

type TwitterBrowserSessionResult = {
  type: string;
  url?: string;
  error?: { message?: string } | string;
  errorCode?: string | null;
};

const describeTwitterSessionResult = (
  sessionResult: TwitterBrowserSessionResult
): TwitterSessionOutcome => {
  if (sessionResult.type === 'success' && sessionResult.url) {
    return { source: 'url', url: sessionResult.url };
  }

  if (sessionResult.type === 'cancel') {
    return { source: 'cancel' };
  }

  if (typeof sessionResult.url === 'string' && isTwitterAuthCallbackUrl(sessionResult.url)) {
    return { source: 'url', url: sessionResult.url };
  }

  if (sessionResult.type === 'locked') {
    return {
      source: 'error',
      message: 'X sign-in could not open because another auth session is already running.',
    };
  }

  if (sessionResult.type === 'error' || sessionResult.error || sessionResult.errorCode) {
    const message =
      (typeof sessionResult.error === 'string' && sessionResult.error) ||
      (typeof sessionResult.error === 'object' && sessionResult.error?.message) ||
      sessionResult.errorCode ||
      'X sign-in failed in the browser.';
    return { source: 'error', message: String(message) };
  }

  return { source: 'dismiss' };
};

const collectTwitterCallbackUrl = async (
  authUrl: string,
  returnUrl: string
): Promise<string> => {
  let resolveLink: ((url: string) => void) | undefined;
  const linkingPromise = new Promise<string>((resolve) => {
    resolveLink = resolve;
  });

  const subscription = Linking.addEventListener('url', (event) => {
    if (isTwitterAuthCallbackUrl(event.url)) {
      resolveLink?.(event.url);
    }
  });

  try {
    const sessionPromise = WebBrowser.openAuthSessionAsync(
      authUrl,
      returnUrl
    ).then((sessionResult) => describeTwitterSessionResult(sessionResult));

    const first = await Promise.race([
      sessionPromise,
      linkingPromise.then((url) =>
        isTwitterAuthCallbackUrl(url)
          ? { source: 'url' as const, url }
          : { source: 'dismiss' as const },
      ),
    ]);
    if (first.source === 'url') {
      try {
        WebBrowser.dismissBrowser();
      } catch {
        // No browser session left to dismiss.
      }
      return first.url;
    }

    const lateLink = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 400);
      void linkingPromise.then((url) => {
        if (!isTwitterAuthCallbackUrl(url)) {
          return;
        }
        clearTimeout(timer);
        resolve(url);
      });
    });
    if (lateLink) {
      return lateLink;
    }

    if (first.source === 'cancel') {
      throw new Error(TWITTER_CANCELLED_MESSAGE);
    }
    if (first.source === 'error') {
      throw new Error(first.message);
    }
    throw new Error(TWITTER_NO_CALLBACK_MESSAGE);
  } finally {
    subscription.remove();
    // Unblock the unused linking waiter so the process can exit.
    resolveLink?.('');
  }
};

export async function loginWithTwitter(): Promise<AuthResponse> {
  // Always advertise the app scheme so the backend uses
  // https://api.irlobby.com/api/auth/twitter/callback/ — never the apex stub.
  const returnUrl = getTwitterMobileRedirectUri();

  const statusResponse = await api.get<TwitterOAuthStatusResponse>(
    API_ROUTES.AUTH_TWITTER_STATUS
  );
  if (!statusResponse.data?.configured) {
    throw new Error('X/Twitter login is not configured on the backend yet.');
  }

  const oauthUrlResponse = await api.get<TwitterOAuthUrlResponse>(
    API_ROUTES.AUTH_TWITTER_URL,
    {
      params: {
        mobile_redirect_uri: returnUrl,
      },
    }
  );

  const authUrl = oauthUrlResponse.data?.auth_url;
  if (!authUrl || !isAllowedTwitterOAuthUrl(authUrl)) {
    throw new Error('Unable to start X/Twitter login. Please try again.');
  }

  const callbackUrl = await collectTwitterCallbackUrl(authUrl, returnUrl);
  const parsed = parseTwitterAuthCallbackUrl(callbackUrl);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  return persistAuthResponse({
    user: parsed.user,
    tokens: {
      accessToken: parsed.access,
      access: parsed.access,
      refreshToken: parsed.refresh,
      refresh: parsed.refresh,
    },
  });
}

export async function loginWithGoogleIdToken(
  idToken: string
): Promise<AuthResponse> {
  const trimmedToken = typeof idToken === 'string' ? idToken.trim() : '';
  if (!trimmedToken) {
    throw new Error(GOOGLE_MISSING_ID_TOKEN_MESSAGE);
  }

  try {
    const response = await api.post<unknown>(API_ROUTES.AUTH_GOOGLE_MOBILE, {
      id_token: trimmedToken,
    });
    const payload = unwrapGoogleAuthPayload(response.data);
    return persistAuthResponse(payload as AuthResponse);
  } catch (error) {
    throw wrapGoogleExchangeError(error, trimmedToken);
  }
}

export async function loginWithAppleIdentityToken(payload: {
  identityToken: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>(API_ROUTES.AUTH_APPLE_MOBILE, {
    identity_token: payload.identityToken,
    email: payload.email,
    first_name: payload.firstName,
    last_name: payload.lastName,
  });
  return persistAuthResponse(response.data);
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

export async function resetPassword(
  token: string,
  password: string
): Promise<void> {
  await api.post(API_ROUTES.AUTH_RESET_PASSWORD, {
    token,
    new_password: password,
  });
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

export async function updateOnboarding(
  payload: OnboardingPayload
): Promise<void> {
  await api.patch(API_ROUTES.USER_ONBOARDING, payload);
}

export async function createInvite(
  payload: InvitePayload
): Promise<InviteResponse> {
  const response = await api.post<InviteResponse>(
    API_ROUTES.USER_INVITES,
    payload
  );
  return response.data;
}
