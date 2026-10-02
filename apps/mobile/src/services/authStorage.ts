import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { AuthTokens } from '../types/auth';

const STORAGE_KEY = '@irlobby/auth/tokens';
const LEGACY_ASYNC_STORAGE_KEY = STORAGE_KEY;
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  keychainService: 'irlobby.auth.tokens',
};

let memoryTokens: AuthTokens | null = null;

const clearLegacyTokens = async () => {
  await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
};

const pickToken = (...candidates: Array<string | undefined>) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return null;
};

const normalizeTokens = (tokens: AuthTokens): AuthTokens => {
  const accessToken = pickToken(tokens.accessToken, tokens.access) ?? '';
  const refreshToken = pickToken(tokens.refreshToken, tokens.refresh) ?? undefined;
  return {
    accessToken,
    refreshToken,
    access: accessToken || tokens.access,
    refresh: refreshToken ?? tokens.refresh,
    expiresIn: tokens.expiresIn,
  };
};

export const authStorage = {
  async getTokens(): Promise<AuthTokens | null> {
    if (memoryTokens) {
      void clearLegacyTokens();
      return memoryTokens;
    }

    try {
      const value = await SecureStore.getItemAsync(STORAGE_KEY, SECURE_STORE_OPTIONS);
      await clearLegacyTokens();
      memoryTokens = value ? normalizeTokens(JSON.parse(value) as AuthTokens) : null;
      return memoryTokens;
    } catch (error) {
      console.warn('[authStorage] Failed to read tokens', error);
      return memoryTokens;
    }
  },
  async setTokens(tokens: AuthTokens): Promise<void> {
    memoryTokens = normalizeTokens(tokens);
    try {
      await SecureStore.setItemAsync(
        STORAGE_KEY,
        JSON.stringify(memoryTokens),
        SECURE_STORE_OPTIONS,
      );
      await clearLegacyTokens();
    } catch (error) {
      console.warn('[authStorage] Failed to persist tokens', error);
    }
  },
  async clearTokens(): Promise<void> {
    memoryTokens = null;
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY, SECURE_STORE_OPTIONS);
      await clearLegacyTokens();
    } catch (error) {
      console.warn('[authStorage] Failed to clear tokens', error);
    }
  },
};

const BIRTH_DATE_PENDING_KEY = '@irlobby/auth/birth-date-pending';

/**
 * Foyer: a social sign-in produced an account with no birth date, so the app stays on the birth-date step
 * (even after a restart) until it is saved or the person signs out.
 */
export const birthDatePendingStorage = {
  async get(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(BIRTH_DATE_PENDING_KEY)) === '1';
    } catch {
      return false;
    }
  },
  async set(pending: boolean): Promise<void> {
    try {
      if (pending) {
        await AsyncStorage.setItem(BIRTH_DATE_PENDING_KEY, '1');
      } else {
        await AsyncStorage.removeItem(BIRTH_DATE_PENDING_KEY);
      }
    } catch (error) {
      console.warn('[authStorage] Failed to persist birth-date step', error);
    }
  },
};

export const getAccessToken = async (): Promise<string | null> => {
  const tokens = await authStorage.getTokens();
  return pickToken(tokens?.accessToken, tokens?.access);
};

export const getRefreshToken = async (): Promise<string | null> => {
  const tokens = await authStorage.getTokens();
  return pickToken(tokens?.refreshToken, tokens?.refresh);
};
