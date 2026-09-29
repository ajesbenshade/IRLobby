import { API_ROUTES, type VibeAnswers } from '@shared/schema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

import { toast } from '../hooks/use-toast';
import { apiRequest } from '../lib/queryClient';

const AUTH_TOKEN_EVENT = 'irlobby:auth-token-changed';

const dispatchAuthTokenChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_TOKEN_EVENT));
  }
};

export interface UserVibe {
  vibeProfile?: string;
  vibeTags?: string[];
  vibeDiscoverTags?: string[];
  vibeAnswers?: VibeAnswers;
  vibeCompletedAt?: string;
  vibeQuizSkipped?: boolean;
}

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  bio?: string;
  interests?: string[];
  photoAlbum?: string[];
  activityPreferences?: Record<string, unknown>;
  vibe?: UserVibe;
  onboardingCompleted?: boolean;
  rating?: number;
  totalRatings?: number;
  eventsHosted?: number;
  eventsAttended?: number;
  swipesRemainingToday?: number | null;
  birthDate?: string;
  sex?: string;
  churchName?: string;
  isCongregationalAdmin?: boolean;
}

const toOptionalNumber = (value: unknown): number | null | undefined => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const normalizeVibe = (vibeSource: Record<string, unknown> | null | undefined): UserVibe | undefined => {
  if (!vibeSource) return undefined;
  return {
    vibeProfile: typeof vibeSource.vibeProfile === 'string' ? vibeSource.vibeProfile : undefined,
    vibeTags: Array.isArray(vibeSource.vibeTags)
      ? vibeSource.vibeTags.filter((tag): tag is string => typeof tag === 'string')
      : undefined,
    vibeDiscoverTags: Array.isArray(vibeSource.vibeDiscoverTags)
      ? vibeSource.vibeDiscoverTags.filter((tag): tag is string => typeof tag === 'string')
      : undefined,
    vibeAnswers:
      vibeSource.vibeAnswers && typeof vibeSource.vibeAnswers === 'object'
        ? (vibeSource.vibeAnswers as VibeAnswers)
        : undefined,
    vibeCompletedAt:
      typeof vibeSource.vibeCompletedAt === 'string' ? vibeSource.vibeCompletedAt : undefined,
    vibeQuizSkipped: Boolean(vibeSource.vibeQuizSkipped),
  };
};

const normalizeUser = (profile: Record<string, unknown>): User => {
  const preferences = asRecord(profile.preferences);
  const activityPreferences =
    asRecord(profile.activityPreferences) ??
    asRecord(profile.activity_preferences) ??
    asRecord(preferences?.activity_preferences) ??
    asRecord(preferences?.activityPreferences);

  const vibeSource =
    asRecord(activityPreferences?.vibe) ?? asRecord(preferences?.vibe) ?? asRecord(profile.vibe);

  return {
    id: String(profile.id ?? ''),
    email: typeof profile.email === 'string' ? profile.email : undefined,
    firstName:
      (typeof profile.firstName === 'string' ? profile.firstName : undefined) ??
      (typeof profile.first_name === 'string' ? profile.first_name : undefined),
    lastName:
      (typeof profile.lastName === 'string' ? profile.lastName : undefined) ??
      (typeof profile.last_name === 'string' ? profile.last_name : undefined),
    profileImageUrl:
      (typeof profile.profileImageUrl === 'string' ? profile.profileImageUrl : undefined) ??
      (typeof profile.avatarUrl === 'string' ? profile.avatarUrl : undefined) ??
      (typeof profile.avatar_url === 'string' ? profile.avatar_url : undefined),
    bio: typeof profile.bio === 'string' ? profile.bio : undefined,
    interests: Array.isArray(profile.interests)
      ? profile.interests.filter((item): item is string => typeof item === 'string')
      : undefined,
    photoAlbum: Array.isArray(profile.photoAlbum)
      ? profile.photoAlbum.filter((item): item is string => typeof item === 'string')
      : Array.isArray(profile.photo_album)
        ? profile.photo_album.filter((item): item is string => typeof item === 'string')
        : undefined,
    activityPreferences,
    vibe: normalizeVibe(vibeSource),
    onboardingCompleted:
      typeof profile.onboardingCompleted === 'boolean'
        ? profile.onboardingCompleted
        : typeof profile.onboarding_completed === 'boolean'
          ? profile.onboarding_completed
          : undefined,
    swipesRemainingToday: toOptionalNumber(
      profile.swipesRemainingToday ?? profile.swipes_remaining_today,
    ),
    birthDate:
      (typeof profile.birthDate === 'string' ? profile.birthDate : undefined) ??
      (typeof profile.birth_date === 'string' ? profile.birth_date : undefined),
    sex: typeof profile.sex === 'string' ? profile.sex : undefined,
    churchName:
      (typeof profile.churchName === 'string' ? profile.churchName : undefined) ??
      (typeof profile.church_name === 'string' ? profile.church_name : undefined),
    isCongregationalAdmin: Boolean(profile.isCongregationalAdmin),
  };
};

type AuthResponsePayload = {
  tokens?: {
    access?: string;
    refresh?: string;
  };
  access?: string;
  refresh?: string;
  user?: {
    id?: string | number;
  };
  detail?: string;
  error?: string;
  birth_date_required?: boolean;
  signup_token?: string;
};

const resolveAuthTokens = (data: AuthResponsePayload) => {
  const accessToken =
    typeof data.tokens?.access === 'string'
      ? data.tokens.access
      : typeof data.access === 'string'
        ? data.access
        : null;

  const refreshToken =
    typeof data.tokens?.refresh === 'string'
      ? data.tokens.refresh
      : typeof data.refresh === 'string'
        ? data.refresh
        : null;

  return { accessToken, refreshToken };
};

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [authError, setAuthError] = useState<string | null>(null);

  const setAuthErrorMessage = useCallback((message: string | null) => {
    setAuthError((prev) => (prev === message ? prev : message));
  }, []);

  const clearStoredCredentials = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');

    localStorage.removeItem('userId');
    dispatchAuthTokenChange();
  }, []);

  useEffect(() => {
    const syncTokenFromStorage = () => {
      const nextToken = localStorage.getItem('authToken');
      setToken((prevToken) => (prevToken === nextToken ? prevToken : nextToken));
    };

    window.addEventListener('storage', syncTokenFromStorage);
    window.addEventListener(AUTH_TOKEN_EVENT, syncTokenFromStorage);

    return () => {
      window.removeEventListener('storage', syncTokenFromStorage);
      window.removeEventListener(AUTH_TOKEN_EVENT, syncTokenFromStorage);
    };
  }, []);

  useEffect(() => {
    if (authError) {
      toast({
        title: 'Authentication issue',
        description: authError,
        variant: 'destructive',
      });
    }
  }, [authError]);

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery<User | null, Error>({
    queryKey: [API_ROUTES.USER_PROFILE],
    enabled: !!token,
    retry: (failureCount, queryError) => {
      if (queryError instanceof Error && /401|403/.test(queryError.message)) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: async () => {
      if (!token) {
        setAuthErrorMessage(null);
        return null;
      }

      try {
        const response = await apiRequest('GET', API_ROUTES.USER_PROFILE);

        if (response.status === 401) {
          console.warn('Invalid token detected, clearing authentication');
          clearStoredCredentials();
          setToken(null);
          queryClient.setQueryData([API_ROUTES.USER_PROFILE], null);
          setAuthErrorMessage('Your session has expired. Please sign in again.');
          return null;
        }

        if (!response.ok) {
          throw new Error(`Profile request failed: ${response.status}`);
        }

        const profile = normalizeUser((await response.json()) as Record<string, unknown>);
        setAuthErrorMessage(null);
        return profile;
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.message.includes('401')) {
          setAuthErrorMessage('Your session has expired. Please sign in again.');
          clearStoredCredentials();
          setToken(null);
          queryClient.setQueryData([API_ROUTES.USER_PROFILE], null);
          return null;
        }

        console.warn('Profile fetch failed:', fetchError);
        setAuthErrorMessage('We could not load your profile. Please try again.');
        throw fetchError;
      }
    },
  });

  const retryProfile = useCallback(async () => {
    const result = await refetch({ throwOnError: false });
    if (!result.error) {
      setAuthErrorMessage(null);
    }
    return result;
  }, [refetch, setAuthErrorMessage]);

  const handleAuthentication = useCallback(
    async (newToken: string, userId: string) => {
      localStorage.setItem('authToken', newToken);
      localStorage.setItem('userId', userId);
      setToken(newToken);
      dispatchAuthTokenChange();
      setAuthErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: [API_ROUTES.USER_PROFILE] });
      await queryClient.refetchQueries({ queryKey: [API_ROUTES.USER_PROFILE] });
    },
    [queryClient, setAuthErrorMessage],
  );

  const persistOAuthResponse = useCallback(
    async (data: AuthResponsePayload) => {
      const { accessToken, refreshToken } = resolveAuthTokens(data);
      const userId = data.user?.id;
      if (!accessToken || userId === undefined || userId === null) {
        throw new Error('OAuth response missing authentication data');
      }
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      await handleAuthentication(accessToken, String(userId));
    },
    [handleAuthentication],
  );

  const loginWithGoogleIdToken = useCallback(
    async (idToken: string, birthDate?: string) => {
      const response = await apiRequest('POST', API_ROUTES.AUTH_GOOGLE_MOBILE, {
        id_token: idToken,
        ...(birthDate ? { birth_date: birthDate } : {}),
      });
      const data = (await response.json()) as AuthResponsePayload;
      if (!response.ok) {
        const error = new Error(data.detail || data.error || 'Google sign-in failed');
        if (data.birth_date_required) {
          (error as Error & { birthDateRequired?: boolean }).birthDateRequired = true;
        }
        throw error;
      }
      await persistOAuthResponse(data);
    },
    [persistOAuthResponse],
  );

  const loginWithAppleIdentityToken = useCallback(
    async (payload: {
      identityToken: string;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      birthDate?: string | null;
    }) => {
      const response = await apiRequest('POST', API_ROUTES.AUTH_APPLE_MOBILE, {
        identity_token: payload.identityToken,
        email: payload.email,
        first_name: payload.firstName,
        last_name: payload.lastName,
        ...(payload.birthDate ? { birth_date: payload.birthDate } : {}),
      });
      const data = (await response.json()) as AuthResponsePayload;
      if (!response.ok) {
        const error = new Error(data.detail || data.error || 'Apple sign-in failed');
        if (data.birth_date_required) {
          (error as Error & { birthDateRequired?: boolean }).birthDateRequired = true;
        }
        throw error;
      }
      await persistOAuthResponse(data);
    },
    [persistOAuthResponse],
  );

  const updateOnboarding = useCallback(async (payload: Record<string, unknown>) => {
    await apiRequest('PATCH', API_ROUTES.USER_ONBOARDING, payload);
    await queryClient.invalidateQueries({ queryKey: [API_ROUTES.USER_PROFILE] });
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      try {
        await apiRequest('POST', API_ROUTES.AUTH_LOGOUT, {});
      } catch (logoutRequestError) {
        console.warn('Logout endpoint failed:', logoutRequestError);
      }

      clearStoredCredentials();
      setToken(null);
      setAuthErrorMessage(null);

      await queryClient.cancelQueries({ type: 'all' });
      queryClient.removeQueries();
    } catch (logoutError) {
      console.error('Logout error:', logoutError);
    }
  }, [clearStoredCredentials, queryClient, setAuthErrorMessage]);

  const refreshToken = useCallback(async () => {
    try {
      const response = await apiRequest('POST', API_ROUTES.AUTH_REFRESH, {});
      const data = await response.json();

      if (typeof data.access !== 'string') {
        throw new Error('Token refresh response missing access token');
      }

      localStorage.setItem('authToken', data.access);
      setToken(data.access);
      dispatchAuthTokenChange();
      setAuthErrorMessage(null);
      return data.access;
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      setAuthErrorMessage('Your session has expired. Please sign in again.');
      await logout();
      return null;
    }
  }, [logout, setAuthErrorMessage]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    needsOnboarding: user?.onboardingCompleted === false,
    token,
    handleAuthentication,
    loginWithGoogleIdToken,
    loginWithAppleIdentityToken,
    updateOnboarding,
    logout,
    refreshToken,
    authError,
    retryProfile,
    profileError: error,
  };
}
