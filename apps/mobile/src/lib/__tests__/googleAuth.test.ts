import {
  completeGoogleAuthPrompt,
  getGoogleIdTokenFromAuthResult,
  GOOGLE_MISSING_ID_TOKEN_MESSAGE,
} from '../googleAuth';

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
