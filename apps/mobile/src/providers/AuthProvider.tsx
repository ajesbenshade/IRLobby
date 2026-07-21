import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { setAnalyticsUser, track } from '@services/analytics';
import { deactivatePushTokens } from '@services/pushNotificationService';
import {
  fetchProfile,
  login,
  loginWithAppleIdentityToken,
  loginWithGoogleIdToken,
  loginWithTwitter,
  logout as logoutService,
  register,
  requestPasswordReset as requestPasswordResetService,
  resetPassword as resetPasswordService,
} from '@services/authService';
import { authStorage } from '@services/authStorage';

import type { AuthUser, LoginPayload, RegisterPayload } from '../types/auth';
import {
  clearUser as clearMonitoringUser,
  setUser as setMonitoringUser,
} from '../lib/monitoring';

interface AuthContextValue {
  user: AuthUser | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  signIn: (payload: LoginPayload) => Promise<AuthUser>;
  signInWithTwitter: () => Promise<AuthUser>;
  signInWithGoogleIdToken: (idToken: string) => Promise<AuthUser>;
  signInWithAppleIdentityToken: (payload: {
    identityToken: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }) => Promise<AuthUser>;
  signUp: (payload: RegisterPayload) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<AuthUser | null>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const tokens = await authStorage.getTokens();
        if (!tokens?.accessToken && !tokens?.access) {
          return;
        }

        const profile = await fetchProfile();
        if (isMounted) {
          setUser(profile);
        }
      } catch (error) {
        console.warn('[AuthProvider] Failed to restore session', error);
        await authStorage.clearTokens();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  // Tag/untag the Sentry user whenever auth state flips. Safe no-op when Sentry
  // isn't initialized (DSN missing or SDK not installed yet).
  useEffect(() => {
    if (user) {
      setMonitoringUser({ id: String(user.id), email: user.email });
    } else {
      clearMonitoringUser();
    }
  }, [user]);

  const signIn = useCallback(async (payload: LoginPayload) => {
    const { user: nextUser } = await login(payload);
    setUser(nextUser);
    setAnalyticsUser({ id: nextUser.id, email: nextUser.email });
    track('login', { method: 'email' });
    return nextUser;
  }, []);

  const signInWithTwitter = useCallback(async () => {
    const { user: nextUser } = await loginWithTwitter();
    setUser(nextUser);
    setAnalyticsUser({ id: nextUser.id, email: nextUser.email });
    track('login', { method: 'twitter' });
    return nextUser;
  }, []);

  const signInWithGoogleIdToken = useCallback(async (idToken: string) => {
    const { user: nextUser } = await loginWithGoogleIdToken(idToken);
    setUser(nextUser);
    setAnalyticsUser({ id: nextUser.id, email: nextUser.email });
    track('login', { method: 'google' });
    return nextUser;
  }, []);

  const signInWithAppleIdentityToken = useCallback(
    async (payload: {
      identityToken: string;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    }) => {
      const { user: nextUser } = await loginWithAppleIdentityToken(payload);
      setUser(nextUser);
      setAnalyticsUser({ id: nextUser.id, email: nextUser.email });
      track('login', { method: 'apple' });
      return nextUser;
    },
    []
  );

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const { user: nextUser } = await register(payload);
    setUser(nextUser);
    setAnalyticsUser({ id: nextUser.id, email: nextUser.email });
    track('sign_up', { method: 'email' });
    return nextUser;
  }, []);

  const signOut = useCallback(async () => {
    await deactivatePushTokens();
    await logoutService();
    setUser(null);
    setAnalyticsUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await fetchProfile();
      setUser(profile);
      return profile;
    } catch (error) {
      console.warn('[AuthProvider] Failed to refresh profile', error);
      return null;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await requestPasswordResetService(email);
  }, []);

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      await resetPasswordService(token, newPassword);
    },
    []
  );

  const value = useMemo(
    () => ({
      user,
      isInitializing,
      isAuthenticated: !!user,
      signIn,
      signInWithTwitter,
      signInWithGoogleIdToken,
      signInWithAppleIdentityToken,
      signUp,
      signOut,
      refreshProfile,
      requestPasswordReset,
      resetPassword,
    }),
    [
      isInitializing,
      refreshProfile,
      requestPasswordReset,
      resetPassword,
      signIn,
      signInWithTwitter,
      signInWithGoogleIdToken,
      signInWithAppleIdentityToken,
      signOut,
      signUp,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
