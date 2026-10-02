import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuthContext } from '../AuthProvider';

jest.mock('@services/analytics', () => ({ setAnalyticsUser: jest.fn(), track: jest.fn() }));
jest.mock('@services/apiClient', () => ({ setSessionExpiredHandler: jest.fn() }));
jest.mock('@services/pushNotificationService', () => ({ deactivatePushTokens: jest.fn(async () => undefined) }));
jest.mock('../../lib/monitoring', () => ({ setUser: jest.fn(), clearUser: jest.fn() }));
jest.mock('@services/authStorage', () => {
  const actual = jest.requireActual('@services/authStorage') as typeof import('@services/authStorage');
  return { ...actual, authStorage: { getTokens: jest.fn(async () => null), clearTokens: jest.fn(async () => undefined), setTokens: jest.fn() } };
});
jest.mock('@services/authService', () => ({
  fetchProfile: jest.fn(),
  login: jest.fn(),
  loginWithAppleIdentityToken: jest.fn(),
  loginWithGoogleIdToken: jest.fn(),
  loginWithTwitter: jest.fn(),
  logout: jest.fn(async () => undefined),
  register: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
  saveBirthDate: jest.fn(),
}));

const service = jest.requireMock('@services/authService') as Record<string, jest.Mock>;
const { authStorage } = jest.requireMock('@services/authStorage') as { authStorage: { getTokens: jest.Mock } };

const FLAG = '@irlobby/auth/birth-date-pending';
const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const render = () => renderHook(() => useAuthContext(), { wrapper });
const settle = async (hook: ReturnType<typeof render>) => waitFor(() => expect(hook.result.current.isInitializing).toBe(false));

const googleUser = (dateOfBirth: string | null) => ({ user: { id: 7, email: 'a@b.co', dateOfBirth }, tokens: {} });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  authStorage.getTokens.mockResolvedValue(null);
  delete process.env.EXPO_PUBLIC_APP_MODE;
});

describe('birth-date step after Apple / Google sign-in (Foyer)', () => {
  it('blocks a Google account with no birth date, and remembers it', async () => {
    service.loginWithGoogleIdToken.mockResolvedValue(googleUser(null));
    const hook = render();
    await settle(hook);
    expect(hook.result.current.needsBirthDate).toBe(false);
    await act(async () => {
      await hook.result.current.signInWithGoogleIdToken('tok');
    });
    expect(hook.result.current.needsBirthDate).toBe(true);
    expect(await AsyncStorage.getItem(FLAG)).toBe('1');
  });

  it('blocks an Apple account with no birth date', async () => {
    service.loginWithAppleIdentityToken.mockResolvedValue(googleUser(null));
    const hook = render();
    await settle(hook);
    await act(async () => {
      await hook.result.current.signInWithAppleIdentityToken({ identityToken: 'x' });
    });
    expect(hook.result.current.needsBirthDate).toBe(true);
  });

  it('does not prompt an existing user who already has a birth date', async () => {
    service.loginWithGoogleIdToken.mockResolvedValue(googleUser('1988-03-04'));
    const hook = render();
    await settle(hook);
    await act(async () => {
      await hook.result.current.signInWithGoogleIdToken('tok');
    });
    expect(hook.result.current.needsBirthDate).toBe(false);
    expect(await AsyncStorage.getItem(FLAG)).toBeNull();
  });

  it('does not prompt in legacy irlobby mode', async () => {
    process.env.EXPO_PUBLIC_APP_MODE = 'irlobby';
    service.loginWithGoogleIdToken.mockResolvedValue(googleUser(null));
    const hook = render();
    await settle(hook);
    await act(async () => {
      await hook.result.current.signInWithGoogleIdToken('tok');
    });
    expect(hook.result.current.needsBirthDate).toBe(false);
  });

  it('does not prompt after email sign-in', async () => {
    service.login.mockResolvedValue(googleUser(null));
    const hook = render();
    await settle(hook);
    await act(async () => {
      await hook.result.current.signIn({ email: 'a@b.co', password: 'x' } as never);
    });
    expect(hook.result.current.needsBirthDate).toBe(false);
  });

  it('saveBirthDate stores it and lets the person in', async () => {
    service.loginWithGoogleIdToken.mockResolvedValue(googleUser(null));
    service.saveBirthDate.mockResolvedValue({ id: 7, email: 'a@b.co', dateOfBirth: '1988-03-04' });
    const hook = render();
    await settle(hook);
    await act(async () => {
      await hook.result.current.signInWithGoogleIdToken('tok');
    });
    await act(async () => {
      await hook.result.current.saveBirthDate('1988-03-04');
    });
    expect(service.saveBirthDate).toHaveBeenCalledWith('1988-03-04');
    expect(hook.result.current.needsBirthDate).toBe(false);
    expect(hook.result.current.user?.dateOfBirth).toBe('1988-03-04');
    expect(await AsyncStorage.getItem(FLAG)).toBeNull();
  });

  it('stays blocked when the server rejects the date', async () => {
    service.loginWithGoogleIdToken.mockResolvedValue(googleUser(null));
    service.saveBirthDate.mockRejectedValue(new Error('Accounts are not available under age 13.'));
    const hook = render();
    await settle(hook);
    await act(async () => {
      await hook.result.current.signInWithGoogleIdToken('tok');
    });
    await act(async () => {
      await expect(hook.result.current.saveBirthDate('2020-01-01')).rejects.toThrow();
    });
    expect(hook.result.current.needsBirthDate).toBe(true);
  });

  it('sign out clears the step', async () => {
    service.loginWithGoogleIdToken.mockResolvedValue(googleUser(null));
    const hook = render();
    await settle(hook);
    await act(async () => {
      await hook.result.current.signInWithGoogleIdToken('tok');
    });
    await act(async () => {
      await hook.result.current.signOut();
    });
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.needsBirthDate).toBe(false);
    expect(await AsyncStorage.getItem(FLAG)).toBeNull();
  });

  it('is still required after an app restart until a date is saved', async () => {
    await AsyncStorage.setItem(FLAG, '1');
    authStorage.getTokens.mockResolvedValue({ accessToken: 'a' });
    service.fetchProfile.mockResolvedValue({ id: 7, email: 'a@b.co', dateOfBirth: null });
    const hook = render();
    await settle(hook);
    expect(hook.result.current.needsBirthDate).toBe(true);
  });

  it('a restored session with a birth date is never prompted, even with a stale flag', async () => {
    await AsyncStorage.setItem(FLAG, '1');
    authStorage.getTokens.mockResolvedValue({ accessToken: 'a' });
    service.fetchProfile.mockResolvedValue({ id: 7, email: 'a@b.co', dateOfBirth: '1990-01-01' });
    const hook = render();
    await settle(hook);
    expect(hook.result.current.needsBirthDate).toBe(false);
  });
});
