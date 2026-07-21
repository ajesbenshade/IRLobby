import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setAnalyticsUser, track } from '@services/analytics';
import {
  fetchProfile,
  login,
  loginWithApple,
  loginWithGoogle,
  loginWithTwitter,
  logout as logoutService,
  register,
  requestPasswordReset as requestPasswordResetService,
  resetPassword as resetPasswordService,
} from '@services/authService';
import { authStorage } from '@services/authStorage';
import { deactivatePushTokens } from '@services/pushNotificationService';

import type { AuthUser, LoginPayload, RegisterPayload } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  signIn: (payload: LoginPayload) => Promise<AuthUser>;
  signInWithTwitter: () => Promise<AuthUser>;
  signInWithApple: () => Promise<AuthUser>;
  signInWithGoogle: () => Promise<AuthUser>;
  signUp: (payload: RegisterPayload) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<AuthUser | null>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const identifyUser = (nextUser: AuthUser) => {
  setAnalyticsUser({ id: nextUser.id, email: nextUser.email });
};

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
          identifyUser(profile);
        }
      } catch (error) {
        console.warn('[AuthProvider] Failed to restore session', error);
        await authStorage.clearTokens();
        if (isMounted) {
          setUser(null);
          setAnalyticsUser(null);
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

  const signIn = useCallback(async (payload: LoginPayload) => {
    const { user: nextUser } = await login(payload);
    setUser(nextUser);
    identifyUser(nextUser);
    track('login', { method: 'email' });
    return nextUser;
  }, []);

  const signInWithTwitter = useCallback(async () => {
    const { user: nextUser } = await loginWithTwitter();
    setUser(nextUser);
    identifyUser(nextUser);
    track('login', { method: 'twitter' });
    return nextUser;
  }, []);

  const signInWithApple = useCallback(async () => {
    const { user: nextUser } = await loginWithApple();
    setUser(nextUser);
    identifyUser(nextUser);
    track('login', { method: 'apple' });
    return nextUser;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { user: nextUser } = await loginWithGoogle();
    setUser(nextUser);
    identifyUser(nextUser);
    track('login', { method: 'google' });
    return nextUser;
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const { user: nextUser } = await register(payload);
    setUser(nextUser);
    identifyUser(nextUser);
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
      identifyUser(profile);
      return profile;
    } catch (error) {
      console.warn('[AuthProvider] Failed to refresh profile', error);
      return null;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await requestPasswordResetService(email);
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    await resetPasswordService(token, newPassword);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isInitializing,
      isAuthenticated: !!user,
      signIn,
      signInWithTwitter,
      signInWithApple,
      signInWithGoogle,
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
      signInWithApple,
      signInWithGoogle,
      signInWithTwitter,
      signOut,
      signUp,
      user,
    ],
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
