import { Platform } from 'react-native';

const mockConfig = {
  googleExpoClientId: undefined as string | undefined,
  googleIosClientId: 'ios-123.apps.googleusercontent.com',
  googleAndroidClientId: 'android-123.apps.googleusercontent.com',
  googleWebClientId: 'web-123.apps.googleusercontent.com',
};

jest.mock('@constants/config', () => ({
  pickConfigString: (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  },
  config: mockConfig,
}));

import {
  completeGoogleAuthPrompt,
  describeMissingGoogleIdToken,
  getGoogleAuthRequestConfig,
  getGoogleIdTokenFromAuthResult,
  getGoogleNativeRedirectUriOptions,
  GOOGLE_MISSING_ID_TOKEN_MESSAGE,
  isGoogleAuthReadyForPlatform,
  peekGoogleTokenAudience,
  reverseGoogleIosClientIdScheme,
  unwrapGoogleAuthPayload,
  wrapGoogleExchangeError,
} from '../googleAuth';

const makeJwt = (payload: Record<string, unknown>) => {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
};

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
  it('reads id_token from params', () => {
    expect(
      getGoogleIdTokenFromAuthResult({
        type: 'success',
        params: { id_token: 'from-params' },
      }),
    ).toBe('from-params');
  });

  it('falls back to authentication.idToken when params are empty', () => {
    expect(
      getGoogleIdTokenFromAuthResult({
        type: 'success',
        params: {},
        authentication: { idToken: 'from-authentication' },
      }),
    ).toBe('from-authentication');
  });

  it('reads params.idToken camelCase', () => {
    expect(
      getGoogleIdTokenFromAuthResult({
        type: 'success',
        params: { idToken: 'camel-case-token' },
      }),
    ).toBe('camel-case-token');
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
    const token = makeJwt({ aud: 'ios-123.apps.googleusercontent.com' });
    const wrapped = wrapGoogleExchangeError(
      new Error('Google sign-in could not be verified.'),
      token,
    );
    expect(wrapped.message).toContain('Google sign-in could not be verified.');
    expect(wrapped.message).toContain('ios-123.apps.googleusercontent.com');
    expect(wrapped.message).toContain('GOOGLE_OAUTH_CLIENT_IDS');
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
    const exchangeCode = jest.fn().mockResolvedValue('exchanged-id-token');

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
    expect(onIdToken).toHaveBeenCalledWith('exchanged-id-token');
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

    await expect(
      completeGoogleAuthPrompt(
        async () => ({
          type: 'success',
          params: { id_token: 'google-id-token' },
        }),
        onIdToken,
      ),
    ).rejects.toThrow('backend exchange failed');

    expect(onIdToken).toHaveBeenCalledWith('google-id-token');
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
