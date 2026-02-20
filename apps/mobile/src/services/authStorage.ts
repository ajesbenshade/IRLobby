import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthTokens } from '../types/auth';

const STORAGE_KEY = '@irlobby/auth/tokens';

export const authStorage = {
  async getTokens(): Promise<AuthTokens | null> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEY);
      return value ? (JSON.parse(value) as AuthTokens) : null;
    } catch (error) {
      console.warn('[authStorage] Failed to read tokens', error);
      return null;
    }
  },
  async setTokens(tokens: AuthTokens): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
      console.warn('[authStorage] Failed to persist tokens', error);
    }
  },
  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
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
