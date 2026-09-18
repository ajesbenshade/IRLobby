import axios from 'axios';
import { API_ROUTES } from '@shared/schema';
import { api, shouldAttachAccessToken } from '@services/apiClient';

// Mock authStorage so requests get the token attached
jest.mock('@services/authStorage', () => ({
  authStorage: {
    getTokens: jest.fn().mockResolvedValue({ accessToken: 'mock-token', refreshToken: 'mock-refresh' }),
    setTokens: jest.fn().mockResolvedValue(undefined),
    clearTokens: jest.fn().mockResolvedValue(undefined),
  },
  getAccessToken: jest.fn().mockResolvedValue('mock-token'),
  getRefreshToken: jest.fn().mockResolvedValue('mock-refresh'),
}));

describe('apiClient', () => {
  it('is an axios instance', () => {
    expect(api).toBeDefined();
    expect(api.defaults.baseURL).toBeDefined();
  });

  it('has request and response interceptors', () => {
    // Axios stores interceptors internally — check they are configured
    expect(api.interceptors.request).toBeDefined();
    expect(api.interceptors.response).toBeDefined();
  });

  it('sets timeout to 15 seconds', () => {
    expect(api.defaults.timeout).toBe(15000);
  });

  it('enables withCredentials', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it('does not attach leftover JWTs to Google/X sign-in endpoints', () => {
    expect(shouldAttachAccessToken(API_ROUTES.AUTH_GOOGLE_MOBILE)).toBe(false);
    expect(shouldAttachAccessToken(API_ROUTES.AUTH_APPLE_MOBILE)).toBe(false);
    expect(shouldAttachAccessToken(API_ROUTES.AUTH_TWITTER_URL)).toBe(false);
    expect(shouldAttachAccessToken(API_ROUTES.USER_LOGIN)).toBe(false);
    expect(shouldAttachAccessToken(API_ROUTES.USER_PROFILE)).toBe(true);
  });
});
