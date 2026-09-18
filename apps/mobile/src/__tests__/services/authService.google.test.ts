import { API_ROUTES } from '@shared/schema';
import { AxiosError } from 'axios';

import {
  GOOGLE_INVALID_ID_TOKEN_MESSAGE,
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

const googleIdToken = (
  overrides: Record<string, unknown> = {},
) => {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode({
    iss: 'https://accounts.google.com',
    aud: 'web.apps.googleusercontent.com',
    sub: 'google-sub',
    ...overrides,
  })}.sig`;
};

const makeAxiosError = (status: number, data: unknown) => {
  const error = new AxiosError('Request failed');
  error.response = {
    status,
    data,
    statusText: 'Error',
    headers: {},
    config: { headers: {} },
  } as AxiosError['response'];
  return error;
};

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

  it('never POSTs an access token or authorization code', async () => {
    await expect(loginWithGoogleIdToken('ya29.access-token')).rejects.toThrow(
      GOOGLE_INVALID_ID_TOKEN_MESSAGE,
    );
    await expect(loginWithGoogleIdToken('4/auth-code')).rejects.toThrow(
      GOOGLE_INVALID_ID_TOKEN_MESSAGE,
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('POSTs /api/auth/google/mobile/ and persists tokens + user', async () => {
    const idToken = googleIdToken();
    mockPost.mockResolvedValue({
      data: {
        user,
        tokens: { access: 'jwt-access', refresh: 'jwt-refresh' },
        created: false,
      },
    });

    const result = await loginWithGoogleIdToken(idToken);

    expect(mockPost).toHaveBeenCalledWith(API_ROUTES.AUTH_GOOGLE_MOBILE, {
      id_token: idToken,
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

    const result = await loginWithGoogleIdToken(googleIdToken());
    expect(result.tokens.accessToken).toBe('alias-access');
    expect(mockSetTokens).toHaveBeenCalled();
  });

  it('does not persist tokens when the user payload is missing', async () => {
    mockPost.mockResolvedValue({
      data: { tokens: { access: 'jwt-access', refresh: 'jwt-refresh' } },
    });

    await expect(loginWithGoogleIdToken(googleIdToken())).rejects.toThrow(
      'Auth response missing user',
    );
    expect(mockSetTokens).not.toHaveBeenCalled();
  });

  it('propagates backend 400 detail from the exchange', async () => {
    mockPost.mockRejectedValue(
      makeAxiosError(400, { error: 'Google identity token is required.' }),
    );

    await expect(loginWithGoogleIdToken(googleIdToken())).rejects.toThrow(
      'Google identity token is required.',
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

    const result = await loginWithGoogleIdToken(googleIdToken());
    expect(result.tokens.accessToken).toBe('nested-access');
    expect(mockSetTokens).toHaveBeenCalled();
  });

  it('adds the token audience when Google verification fails', async () => {
    const idToken = googleIdToken({ aud: 'ios.apps.googleusercontent.com' });
    mockPost.mockRejectedValue(new Error('Google sign-in could not be verified.'));

    await expect(loginWithGoogleIdToken(idToken)).rejects.toThrow(
      'Google sign-in could not be verified. Token audience ios.apps.googleusercontent.com must be listed in backend GOOGLE_OAUTH_CLIENT_IDS.',
    );
  });
});
