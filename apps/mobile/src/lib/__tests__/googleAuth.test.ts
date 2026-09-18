import { Platform } from 'react-native';

jest.mock('@constants/config', () => ({
  config: {
    googleExpoClientId: undefined as string | undefined,
    googleIosClientId: 'ios-123.apps.googleusercontent.com',
    googleAndroidClientId: 'android-123.apps.googleusercontent.com',
    googleWebClientId: 'web-123.apps.googleusercontent.com',
  },
}));

import { config } from '@constants/config';
import {
  completeGoogleAuthPrompt,
  describeMissingGoogleIdToken,
  getGoogleAuthRequestConfig,
  getGoogleIdTokenFromAuthResult,
  getGoogleNativeRedirectUriOptions,
  GOOGLE_INVALID_ID_TOKEN_MESSAGE,
  GOOGLE_MISSING_ID_TOKEN_MESSAGE,
  isGoogleAuthReadyForPlatform,
  isGoogleIdToken,
  peekGoogleTokenAudience,
  reverseGoogleIosClientIdScheme,
  unwrapGoogleAuthPayload,
  wrapGoogleExchangeError,
} from '../googleAuth';

const mockConfig = config as {
  googleExpoClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
  googleWebClientId?: string;
};

const makeJwt = (payload: Record<string, unknown>) => {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
};

const googleIdToken = (
  overrides: Record<string, unknown> = {},
) =>
  makeJwt({
    iss: 'https://accounts.google.com',
    aud: 'web-123.apps.googleusercontent.com',
    sub: 'google-sub',
    email: 'aaron@example.com',
    email_verified: true,
    ...overrides,
  });

describe('getGoogleAuthRequestConfig', () => {
  it('includes webClientId, openid, and disables auto code exchange', () => {
    const requestConfig = getGoogleAuthRequestConfig();
    expect(requestConfig.webClientId).toBe('web-123.apps.googleusercontent.com');
    expect(requestConfig.iosClientId).toBe('ios-123.apps.googleusercontent.com');
    expect(requestConfig.clientId).toBe('web-123.apps.googleusercontent.com');
    expect(requestConfig.scopes).toEqual(['openid', 'profile', 'email']);
    expect(requestConfig.shouldAutoExchangeCode).toBe(false);
  });
});

describe('isGoogleAuthReadyForPlatform', () => {
  afterEach(() => {
    mockConfig.googleWebClientId = 'web-123.apps.googleusercontent.com';
    mockConfig.googleIosClientId = 'ios-123.apps.googleusercontent.com';
  });

  it('requires both iosClientId and webClientId on iOS', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
    expect(isGoogleAuthReadyForPlatform()).toBe(true);
    mockConfig.googleWebClientId = undefined;
    expect(isGoogleAuthReadyForPlatform()).toBe(false);
  });

  it('requires both androidClientId and webClientId on Android', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    expect(isGoogleAuthReadyForPlatform()).toBe(true);
    mockConfig.googleWebClientId = undefined;
    expect(isGoogleAuthReadyForPlatform()).toBe(false);
  });
});

describe('getGoogleNativeRedirectUriOptions', () => {
  it('uses the reversed iOS client ID as the native redirect', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
    expect(reverseGoogleIosClientIdScheme('ios-123.apps.googleusercontent.com')).toBe(
      'com.googleusercontent.apps.ios-123',
    );
    expect(getGoogleNativeRedirectUriOptions()).toEqual({
      native: 'com.googleusercontent.apps.ios-123:/oauthredirect',
    });
  });
});

describe('getGoogleIdTokenFromAuthResult', () => {
  it('reads a Google id_token JWT from params', () => {
    const idToken = googleIdToken();
    expect(
      getGoogleIdTokenFromAuthResult({
        type: 'success',
        params: { id_token: idToken },
      }),
    ).toBe(idToken);
  });

  it('falls back to authentication.idToken when params are empty', () => {
    const idToken = googleIdToken({ aud: 'ios-123.apps.googleusercontent.com' });
    expect(
      getGoogleIdTokenFromAuthResult({
        type: 'success',
        params: {},
        authentication: { idToken },
      }),
    ).toBe(idToken);
  });

  it('reads params.idToken camelCase', () => {
    const idToken = googleIdToken();
    expect(
      getGoogleIdTokenFromAuthResult({
        type: 'success',
        params: { idToken },
      }),
    ).toBe(idToken);
  });

  it('ignores access tokens, auth codes, and non-Google JWTs', () => {
    expect(
      getGoogleIdTokenFromAuthResult({
        type: 'success',
        params: {
          access_token: 'ya29.not-an-id-token',
          code: '4/auth-code',
          id_token: 'not-a-jwt',
        },
        authentication: { idToken: makeJwt({ iss: 'https://example.com', aud: 'x', sub: 'y' }) },
      }),
    ).toBeNull();
  });

  it('returns null when Google authorized without an identity token', () => {
    expect(
      getGoogleIdTokenFromAuthResult({
        type: 'success',
        params: { access_token: 'not-an-id-token' },
        authentication: { idToken: null },
      }),
    ).toBeNull();
  });
});

describe('isGoogleIdToken', () => {
  it('accepts Google OpenID JWTs and rejects garbage', () => {
    expect(isGoogleIdToken(googleIdToken())).toBe(true);
    expect(isGoogleIdToken('ya29.access-token')).toBe(false);
    expect(isGoogleIdToken('4/auth-code')).toBe(false);
    expect(isGoogleIdToken('aaa.bbb.ccc')).toBe(false);
  });
});

describe('peekGoogleTokenAudience', () => {
  it('reads aud from an unsigned JWT payload', () => {
    const token = makeJwt({
      aud: 'web-123.apps.googleusercontent.com',
      sub: 'google-sub',
    });
    expect(peekGoogleTokenAudience(token)).toBe('web-123.apps.googleusercontent.com');
  });
});

describe('unwrapGoogleAuthPayload', () => {
  it('unwraps nested data envelopes', () => {
    expect(
      unwrapGoogleAuthPayload({
        data: {
          user: { id: 1, email: 'a@b.c' },
          tokens: { access: 'a', refresh: 'r' },
        },
      }),
    ).toEqual({
      user: { id: 1, email: 'a@b.c' },
      tokens: { access: 'a', refresh: 'r' },
    });
  });

  it('parses string JSON bodies', () => {
    expect(
      unwrapGoogleAuthPayload(
        JSON.stringify({
          user: { id: 2 },
          tokens: { access: 'a' },
        }),
      ),
    ).toEqual({
      user: { id: 2 },
      tokens: { access: 'a' },
    });
  });
});

describe('wrapGoogleExchangeError', () => {
  it('appends the token audience when verification failed', () => {
    const token = googleIdToken({ aud: 'ios-123.apps.googleusercontent.com' });
    const wrapped = wrapGoogleExchangeError(
      new Error('Google sign-in could not be verified.'),
      token,
    );
    expect(wrapped.message).toContain('Google sign-in could not be verified.');
    expect(wrapped.message).toContain('ios-123.apps.googleusercontent.com');
    expect(wrapped.message).toContain('GOOGLE_OAUTH_CLIENT_IDS');
  });

  it('surfaces backend 400 error JSON as the message', () => {
    const { AxiosError } = require('axios') as typeof import('axios');
    const error = new AxiosError('Request failed');
    error.response = {
      status: 400,
      data: { error: 'Google identity token is required.' },
      statusText: 'Bad Request',
      headers: {},
      config: { headers: {} },
    } as AxiosError['response'];

    expect(wrapGoogleExchangeError(error, googleIdToken()).message).toBe(
      'Google identity token is required.',
    );
  });
});

describe('completeGoogleAuthPrompt', () => {
  it('returns cancelled without calling onIdToken', async () => {
    const onIdToken = jest.fn();

    await expect(
      completeGoogleAuthPrompt(async () => ({ type: 'cancel' }), onIdToken),
    ).resolves.toBe('cancelled');
    await expect(
      completeGoogleAuthPrompt(async () => ({ type: 'dismiss' }), onIdToken),
    ).resolves.toBe('cancelled');
    expect(onIdToken).not.toHaveBeenCalled();
  });

  it('throws when Google returns success without an identity token', async () => {
    const onIdToken = jest.fn();

    await expect(
      completeGoogleAuthPrompt(
        async () => ({ type: 'success', params: {} }),
        onIdToken,
      ),
    ).rejects.toThrow(GOOGLE_MISSING_ID_TOKEN_MESSAGE);
    expect(onIdToken).not.toHaveBeenCalled();
  });

  it('exchanges an authorization code when promptAsync has no id_token', async () => {
    const onIdToken = jest.fn();
    const exchanged = googleIdToken();
    const exchangeCode = jest.fn().mockResolvedValue(exchanged);

    await expect(
      completeGoogleAuthPrompt(
        async () => ({
          type: 'success',
          params: { code: 'auth-code' },
        }),
        onIdToken,
        {
          request: {
            clientId: 'ios-123.apps.googleusercontent.com',
            redirectUri: 'com.googleusercontent.apps.ios-123:/oauthredirect',
            codeVerifier: 'pkce',
          },
          exchangeCode,
        },
      ),
    ).resolves.toBe('signed-in');

    expect(exchangeCode).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'ios-123.apps.googleusercontent.com',
      }),
      'auth-code',
    );
    expect(onIdToken).toHaveBeenCalledWith(exchanged);
  });

  it('does not treat a garbage params.id_token as an identity token', async () => {
    const onIdToken = jest.fn();
    const exchanged = googleIdToken();
    const exchangeCode = jest.fn().mockResolvedValue(exchanged);

    await completeGoogleAuthPrompt(
      async () => ({
        type: 'success',
        params: { id_token: 'ya29.access-token', code: 'auth-code' },
      }),
      onIdToken,
      {
        request: {
          clientId: 'ios-123.apps.googleusercontent.com',
          redirectUri: 'com.googleusercontent.apps.ios-123:/oauthredirect',
        },
        exchangeCode,
      },
    );

    expect(exchangeCode).toHaveBeenCalledWith(expect.any(Object), 'auth-code');
    expect(onIdToken).toHaveBeenCalledWith(exchanged);
  });

  it('rejects an exchanged token that is not a Google ID JWT', async () => {
    await expect(
      completeGoogleAuthPrompt(
        async () => ({
          type: 'success',
          params: { code: 'auth-code' },
        }),
        jest.fn(),
        {
          request: { clientId: 'ios', redirectUri: 'irlobby://' },
          exchangeCode: async () => 'ya29.access-token',
        },
      ),
    ).rejects.toThrow(GOOGLE_INVALID_ID_TOKEN_MESSAGE);
  });

  it('describes a failed code exchange without an identity token', () => {
    expect(
      describeMissingGoogleIdToken({
        type: 'success',
        params: { code: 'auth-code' },
      }),
    ).toMatch(/GOOGLE_OAUTH_CLIENT_IDS/);
  });

  it('exchanges the identity token and propagates onIdToken failures', async () => {
    const onIdToken = jest.fn().mockRejectedValue(new Error('backend exchange failed'));
    const idToken = googleIdToken();

    await expect(
      completeGoogleAuthPrompt(
        async () => ({
          type: 'success',
          params: { id_token: idToken },
        }),
        onIdToken,
      ),
    ).rejects.toThrow('backend exchange failed');

    expect(onIdToken).toHaveBeenCalledWith(idToken);
  });

  it('surfaces browser-level Google errors', async () => {
    await expect(
      completeGoogleAuthPrompt(
        async () => ({
          type: 'error',
          errorCode: 'access_denied',
          error: { message: 'The user cancelled Google sign-in.' },
        }),
        jest.fn(),
      ),
    ).rejects.toThrow('The user cancelled Google sign-in.');
  });
});
