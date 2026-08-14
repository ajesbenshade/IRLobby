import { authStorage, getAccessToken, getRefreshToken } from '@services/authStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = '@irlobby/auth/tokens';

const mockTokens = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresIn: 3600,
};

const normalizedTokens = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  access: 'test-access-token',
  refresh: 'test-refresh-token',
  expiresIn: 3600,
};

beforeEach(async () => {
  await authStorage.clearTokens();
  await AsyncStorage.clear();
  (SecureStore as unknown as { __reset: () => void }).__reset();
  jest.clearAllMocks();
});

describe('authStorage', () => {
  it('returns null when no tokens stored', async () => {
    const tokens = await authStorage.getTokens();
    expect(tokens).toBeNull();
  });

  it('stores and retrieves tokens', async () => {
    await authStorage.setTokens(mockTokens);
    const tokens = await authStorage.getTokens();
    expect(tokens).toEqual(normalizedTokens);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(normalizedTokens),
      expect.any(Object),
    );
    await expect(AsyncStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
  });

  it('clears tokens', async () => {
    await authStorage.setTokens(mockTokens);
    await authStorage.clearTokens();
    const tokens = await authStorage.getTokens();
    expect(tokens).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(STORAGE_KEY, expect.any(Object));
  });

  it('removes legacy AsyncStorage tokens without reading them as auth state', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mockTokens));

    const tokens = await authStorage.getTokens();

    expect(tokens).toBeNull();
    await expect(AsyncStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
  });

  it('keeps tokens in memory if SecureStore write fails', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keychain'));
    await authStorage.setTokens(mockTokens);
    await expect(getAccessToken()).resolves.toBe('test-access-token');
  });
});

describe('getAccessToken', () => {
  it('returns null when no tokens stored', async () => {
    const token = await getAccessToken();
    expect(token).toBeNull();
  });

  it('returns access token when stored', async () => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(mockTokens));
    const token = await getAccessToken();
    expect(token).toBe('test-access-token');
  });

  it('reads JWT access alias when accessToken is missing', async () => {
    await SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify({ access: 'jwt-access', refresh: 'jwt-refresh' }),
    );
    await expect(getAccessToken()).resolves.toBe('jwt-access');
    await expect(getRefreshToken()).resolves.toBe('jwt-refresh');
  });
});

describe('getRefreshToken', () => {
  it('returns null when no tokens stored', async () => {
    const token = await getRefreshToken();
    expect(token).toBeNull();
  });

  it('returns refresh token when stored', async () => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(mockTokens));
    const token = await getRefreshToken();
    expect(token).toBe('test-refresh-token');
  });
});
