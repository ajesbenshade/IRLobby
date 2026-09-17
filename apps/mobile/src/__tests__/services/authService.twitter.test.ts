import { API_ROUTES } from '@shared/schema';

const mockGet = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
const mockDismissBrowser = jest.fn();
const mockRemove = jest.fn();
const mockAddEventListener = jest.fn(() => ({ remove: mockRemove }));
const mockSetTokens = jest.fn().mockResolvedValue(undefined);

jest.mock('@services/apiClient', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: (...args: unknown[]) => mockOpenAuthSessionAsync(...args),
  dismissBrowser: (...args: unknown[]) => mockDismissBrowser(...args),
}));

jest.mock('expo-linking', () => ({
  addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  createURL: jest.fn(() => 'exp://127.0.0.1:8081/--/auth/twitter'),
}));

jest.mock('@services/authStorage', () => ({
  authStorage: {
    setTokens: (...args: unknown[]) => mockSetTokens(...args),
    getTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

jest.mock('@constants/config', () => ({
  config: {
    twitterRedirectUri: 'https://irlobby.com/auth/twitter/callback',
    apiBaseUrl: 'https://api.irlobby.com',
  },
}));

import { loginWithTwitter } from '@services/authService';
import { MOBILE_TWITTER_REDIRECT_URI } from '@lib/twitterAuth';

const user = { id: 42, email: 'host@irlobby.com' };

describe('loginWithTwitter', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockOpenAuthSessionAsync.mockReset();
    mockDismissBrowser.mockReset();
    mockRemove.mockReset();
    mockAddEventListener.mockClear();
    mockSetTokens.mockClear();
  });

  it('requests the auth URL with irlobby://auth/twitter even if env is the apex stub', async () => {
    mockGet.mockResolvedValueOnce({ data: { configured: true } }).mockResolvedValueOnce({
      data: {
        auth_url:
          'https://twitter.com/i/oauth2/authorize?client_id=abc&redirect_uri=https%3A%2F%2Fapi.irlobby.com%2Fapi%2Fauth%2Ftwitter%2Fcallback%2F',
      },
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: `irlobby://auth/twitter?access=access-1&refresh=refresh-1&user=${encodeURIComponent(
        JSON.stringify(user),
      )}`,
    });

    const result = await loginWithTwitter();

    expect(mockGet).toHaveBeenNthCalledWith(2, API_ROUTES.AUTH_TWITTER_URL, {
      params: { mobile_redirect_uri: MOBILE_TWITTER_REDIRECT_URI },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      expect.stringContaining('https://twitter.com/i/oauth2/authorize'),
      'irlobby://auth/twitter',
    );
    expect(result.tokens.accessToken).toBe('access-1');
    expect(result.user.email).toBe('host@irlobby.com');
    expect(mockSetTokens).toHaveBeenCalled();
  });

  it('does not use Linking.createURL or the broken apex redirect', async () => {
    mockGet.mockResolvedValueOnce({ data: { configured: true } }).mockResolvedValueOnce({
      data: { auth_url: 'https://x.com/i/oauth2/authorize?client_id=abc' },
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: `irlobby://auth/twitter?access=access-2&user=${encodeURIComponent(
        JSON.stringify(user),
      )}`,
    });

    await loginWithTwitter();

    const urlCall = mockGet.mock.calls.find(
      (call) => call[0] === API_ROUTES.AUTH_TWITTER_URL,
    );
    expect(urlCall?.[1]).toEqual({
      params: { mobile_redirect_uri: 'irlobby://auth/twitter' },
    });
    expect(JSON.stringify(urlCall)).not.toContain('irlobby.com/auth/twitter/callback');
    expect(JSON.stringify(urlCall)).not.toContain('exp://');
  });

  it('finishes sign-in from the return deep link when the browser session dismisses', async () => {
    mockGet.mockResolvedValueOnce({ data: { configured: true } }).mockResolvedValueOnce({
      data: { auth_url: 'https://twitter.com/i/oauth2/authorize?client_id=abc' },
    });

    mockAddEventListener.mockImplementation((_event, handler) => {
      handler({
        url: `irlobby://auth/twitter?access=from-link&user=${encodeURIComponent(
          JSON.stringify(user),
        )}`,
      });
      return { remove: mockRemove };
    });
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'dismiss' });

    const result = await loginWithTwitter();
    expect(result.tokens.accessToken).toBe('from-link');
  });

  it('throws when X is not configured', async () => {
    mockGet.mockResolvedValueOnce({ data: { configured: false } });
    await expect(loginWithTwitter()).rejects.toThrow(
      'X/Twitter login is not configured on the backend yet.',
    );
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
  });
});
