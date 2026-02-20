import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  deactivatePushTokens,
  registerCurrentDevicePushToken,
} from '@services/pushNotificationService';
import {
  fetchProfile,
  login,
  loginWithTwitter,
  logout as logoutService,
  register,
  requestPasswordReset as requestPasswordResetService,
  resetPassword as resetPasswordService,
} from '@services/authService';
import { authStorage } from '@services/authStorage';

import type { AuthUser, LoginPayload, RegisterPayload } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  signIn: (payload: LoginPayload) => Promise<AuthUser>;
  signInWithTwitter: () => Promise<AuthUser>;
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
  const registeredPushUserIdRef = useRef<string | number | null>(null);

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

  const signIn = useCallback(async (payload: LoginPayload) => {
    const { user: nextUser } = await login(payload);
    setUser(nextUser);
    return nextUser;
  }, []);

  const signInWithTwitter = useCallback(async () => {
    const { user: nextUser } = await loginWithTwitter();
    setUser(nextUser);
    return nextUser;
  }, []);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const { user: nextUser } = await register(payload);
    setUser(nextUser);
    return nextUser;
  }, []);

  const signOut = useCallback(async () => {
    await deactivatePushTokens();
    await logoutService();
    registeredPushUserIdRef.current = null;
    setUser(null);
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

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    await resetPasswordService(token, newPassword);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      registeredPushUserIdRef.current = null;
      return;
    }

    if (registeredPushUserIdRef.current === user.id) {
      return;
    }

    registeredPushUserIdRef.current = user.id;
    void registerCurrentDevicePushToken();
  }, [user?.id]);

  const value = useMemo(
    () => ({
      user,
      isInitializing,
      isAuthenticated: !!user,
      signIn,
      signInWithTwitter,
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
