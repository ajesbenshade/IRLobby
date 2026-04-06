import { authStorage, getAccessToken, getRefreshToken } from '@services/authStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@irlobby/auth/tokens';

const mockTokens = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresIn: 3600,
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('authStorage', () => {
  it('returns null when no tokens stored', async () => {
    const tokens = await authStorage.getTokens();
    expect(tokens).toBeNull();
  });

  it('stores and retrieves tokens', async () => {
    await authStorage.setTokens(mockTokens);
    const tokens = await authStorage.getTokens();
    expect(tokens).toEqual(mockTokens);
  });

  it('clears tokens', async () => {
    await authStorage.setTokens(mockTokens);
    await authStorage.clearTokens();
    const tokens = await authStorage.getTokens();
    expect(tokens).toBeNull();
  });
});

describe('getAccessToken', () => {
  it('returns null when no tokens stored', async () => {
    const token = await getAccessToken();
    expect(token).toBeNull();
  });

  it('returns access token when stored', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mockTokens));
    const token = await getAccessToken();
    expect(token).toBe('test-access-token');
  });
});

describe('getRefreshToken', () => {
  it('returns null when no tokens stored', async () => {
    const token = await getRefreshToken();
    expect(token).toBeNull();
  });

  it('returns refresh token when stored', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mockTokens));
    const token = await getRefreshToken();
    expect(token).toBe('test-refresh-token');
  });
});
