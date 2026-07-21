import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import type { AuthTokens } from '../types/auth';

const STORAGE_KEY = '@irlobby/auth/tokens';
const LEGACY_ASYNC_STORAGE_KEY = STORAGE_KEY;
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  keychainService: 'irlobby.auth.tokens',
};

const clearLegacyTokens = async () => {
  await AsyncStorage.removeItem(LEGACY_ASYNC_STORAGE_KEY);
};

export const authStorage = {
  async getTokens(): Promise<AuthTokens | null> {
    try {
      const value = await SecureStore.getItemAsync(STORAGE_KEY, SECURE_STORE_OPTIONS);
      await clearLegacyTokens();
      return value ? (JSON.parse(value) as AuthTokens) : null;
    } catch (error) {
      console.warn('[authStorage] Failed to read tokens', error);
      return null;
    }
  },
  async setTokens(tokens: AuthTokens): Promise<void> {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(tokens), SECURE_STORE_OPTIONS);
      await clearLegacyTokens();
    } catch (error) {
      console.warn('[authStorage] Failed to persist tokens', error);
    }
  },
  async clearTokens(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY, SECURE_STORE_OPTIONS);
      await clearLegacyTokens();
    } catch (error) {
      console.warn('[authStorage] Failed to clear tokens', error);
    }
  },
};

export const getAccessToken = async (): Promise<string | null> => {
  const tokens = await authStorage.getTokens();
  return tokens?.accessToken ?? null;
};

export const getRefreshToken = async (): Promise<string | null> => {
  const tokens = await authStorage.getTokens();
  return tokens?.refreshToken ?? null;
};
