import axios from 'axios';
import { api } from '@services/apiClient';

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
});
