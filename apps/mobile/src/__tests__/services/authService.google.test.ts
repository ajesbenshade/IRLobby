import { API_ROUTES } from '@shared/schema';

import {
  GOOGLE_MISSING_ID_TOKEN_MESSAGE,
} from '@lib/googleAuth';

const mockPost = jest.fn();
const mockSetTokens = jest.fn().mockResolvedValue(undefined);

jest.mock('@services/apiClient', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

jest.mock('@services/authStorage', () => ({
  authStorage: {
    setTokens: (...args: unknown[]) => mockSetTokens(...args),
    getTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

import { loginWithGoogleIdToken } from '@services/authService';

const user = { id: 9, email: 'google@irlobby.com', firstName: 'Ada' };

describe('loginWithGoogleIdToken', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockSetTokens.mockClear();
  });

  it('rejects a missing identity token before calling the backend', async () => {
    await expect(loginWithGoogleIdToken('   ')).rejects.toThrow(
      GOOGLE_MISSING_ID_TOKEN_MESSAGE,
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('POSTs /api/auth/google/mobile/ and persists tokens + user', async () => {
    mockPost.mockResolvedValue({
      data: {
        user,
        tokens: { access: 'jwt-access', refresh: 'jwt-refresh' },
        created: false,
      },
    });

    const result = await loginWithGoogleIdToken('google-id-token');

    expect(mockPost).toHaveBeenCalledWith(API_ROUTES.AUTH_GOOGLE_MOBILE, {
      id_token: 'google-id-token',
    });
    expect(API_ROUTES.AUTH_GOOGLE_MOBILE).toBe('/api/auth/google/mobile/');
    expect(result.user.email).toBe('google@irlobby.com');
    expect(result.tokens.accessToken).toBe('jwt-access');
    expect(mockSetTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'jwt-access',
        refreshToken: 'jwt-refresh',
      }),
    );
  });

  it('accepts top-level access/refresh aliases from the exchange', async () => {
    mockPost.mockResolvedValue({
      data: {
        user,
        access: 'alias-access',
        refresh: 'alias-refresh',
      },
    });

    const result = await loginWithGoogleIdToken('google-id-token');
    expect(result.tokens.accessToken).toBe('alias-access');
    expect(mockSetTokens).toHaveBeenCalled();
  });

  it('does not persist tokens when the user payload is missing', async () => {
    mockPost.mockResolvedValue({
      data: { tokens: { access: 'jwt-access', refresh: 'jwt-refresh' } },
    });

    await expect(loginWithGoogleIdToken('google-id-token')).rejects.toThrow(
      'Auth response missing user',
    );
    expect(mockSetTokens).not.toHaveBeenCalled();
  });

  it('propagates backend exchange failures', async () => {
    mockPost.mockRejectedValue(new Error('Google sign-in could not be verified.'));

    await expect(loginWithGoogleIdToken('google-id-token')).rejects.toThrow(
      'Google sign-in could not be verified.',
    );
    expect(mockSetTokens).not.toHaveBeenCalled();
  });

  it('unwraps nested data envelopes from the exchange', async () => {
    mockPost.mockResolvedValue({
      data: {
        data: {
          user,
          tokens: { access: 'nested-access', refresh: 'nested-refresh' },
        },
      },
    });

    const result = await loginWithGoogleIdToken('google-id-token');
    expect(result.tokens.accessToken).toBe('nested-access');
    expect(mockSetTokens).toHaveBeenCalled();
  });

  it('adds the token audience when Google verification fails', async () => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const idToken = `${encode({ alg: 'none' })}.${encode({
      aud: 'ios.apps.googleusercontent.com',
    })}.sig`;
    mockPost.mockRejectedValue(new Error('Google sign-in could not be verified.'));

    await expect(loginWithGoogleIdToken(idToken)).rejects.toThrow(
      'Google sign-in could not be verified. Token audience ios.apps.googleusercontent.com must be listed in backend GOOGLE_OAUTH_CLIENT_IDS.',
    );
  });
});
