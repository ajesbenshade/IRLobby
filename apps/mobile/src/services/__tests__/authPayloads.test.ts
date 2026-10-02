import { buildAppleAuthBody } from '../authService';

jest.mock('../apiClient', () => ({ api: { post: jest.fn(), get: jest.fn() } }));

describe('Apple sign-in payload', () => {
  const base = { identityToken: 'tok', email: 'a@b.co', firstName: 'A', lastName: 'B' };

  it('includes authorization_code only when Apple returned one', () => {
    expect(buildAppleAuthBody({ ...base, authorizationCode: 'code-123' })).toMatchObject({
      identity_token: 'tok',
      authorization_code: 'code-123',
    });
    for (const empty of [null, undefined, '', '   ']) {
      expect(buildAppleAuthBody({ ...base, authorizationCode: empty as never })).not.toHaveProperty('authorization_code');
    }
  });
});

describe('legal acceptance fields on sign-up and social sign-in', () => {
  it('adds terms/privacy acceptance and version strings only when the box was ticked', () => {
    const { legalAcceptanceFields } = jest.requireActual('../authService') as typeof import('../authService');
    expect(legalAcceptanceFields(true)).toEqual({
      terms_accepted: true,
      privacy_accepted: true,
      terms_version: expect.any(String),
      privacy_version: expect.any(String),
    });
    expect(legalAcceptanceFields(false)).toEqual({});
    expect(legalAcceptanceFields(undefined)).toEqual({});
  });

  it('sends them with Apple sign-in next to authorization_code, and not when unticked', () => {
    const base = { identityToken: 'tok', authorizationCode: 'code-1' };
    expect(buildAppleAuthBody({ ...base, acceptedLegal: true })).toMatchObject({
      authorization_code: 'code-1',
      terms_accepted: true,
      privacy_accepted: true,
      terms_version: expect.any(String),
      privacy_version: expect.any(String),
    });
    expect(buildAppleAuthBody(base)).not.toHaveProperty('terms_accepted');
  });
});

describe('social sign-in request bodies carry the legal flags (Login and Sign up share them)', () => {
  it('Google exchange posts terms/privacy flags and versions when accepted, none otherwise', async () => {
    const { api } = jest.requireMock('../apiClient') as { api: { post: jest.Mock } };
    const { loginWithGoogleIdToken } = jest.requireActual('../authService') as typeof import('../authService');
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const idToken = `${encode({ alg: 'none' })}.${encode({ iss: 'https://accounts.google.com', aud: 'web.apps.googleusercontent.com', sub: 'g' })}.sig`;
    api.post.mockResolvedValue({ data: { access: 'a', refresh: 'r', user: { id: 1, email: 'a@b.co' } } });

    await loginWithGoogleIdToken(idToken, { acceptedLegal: true }).catch(() => undefined);
    expect(api.post.mock.calls[0][1]).toMatchObject({
      id_token: idToken,
      terms_accepted: true,
      privacy_accepted: true,
      terms_version: expect.any(String),
      privacy_version: expect.any(String),
    });

    api.post.mockClear();
    await loginWithGoogleIdToken(idToken).catch(() => undefined);
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('terms_accepted');
  });

  it('Apple body from Login matches the body from Sign up (same flags, same versions)', () => {
    const base = { identityToken: 'tok', authorizationCode: 'c', email: 'a@b.co', firstName: 'A', lastName: 'B' };
    const body = buildAppleAuthBody({ ...base, acceptedLegal: true });
    expect(body).toEqual({
      identity_token: 'tok',
      authorization_code: 'c',
      email: 'a@b.co',
      first_name: 'A',
      last_name: 'B',
      terms_accepted: true,
      privacy_accepted: true,
      terms_version: expect.any(String),
      privacy_version: expect.any(String),
    });
  });

  it('persistLegalAcceptance PATCHes the onboarding flags and never throws', async () => {
    const { api } = jest.requireMock('../apiClient') as { api: { patch?: jest.Mock } };
    api.patch = jest.fn().mockRejectedValue(new Error('offline'));
    const { persistLegalAcceptance } = jest.requireActual('../authService') as typeof import('../authService');
    await expect(persistLegalAcceptance()).resolves.toBeUndefined();
    expect(api.patch).toHaveBeenCalledWith(expect.any(String), { terms_accepted: true, privacy_accepted: true });
  });
});

describe('saveBirthDate (birth date step after social sign-in)', () => {
  it('PATCHes /api/users/profile/ with date_of_birth and returns the user with the date', async () => {
    const { api } = jest.requireMock('../apiClient') as { api: { patch?: jest.Mock } };
    api.patch = jest.fn().mockResolvedValue({ data: { id: 3, email: 'a@b.co', date_of_birth: '1988-03-04' } });
    const { saveBirthDate } = jest.requireActual('../authService') as typeof import('../authService');
    const saved = await saveBirthDate('1988-03-04');
    expect(api.patch).toHaveBeenCalledWith('/api/users/profile/', { date_of_birth: '1988-03-04' });
    expect(saved.dateOfBirth).toBe('1988-03-04');
  });

  it('falls back to the sent date if the response omits it', async () => {
    const { api } = jest.requireMock('../apiClient') as { api: { patch?: jest.Mock } };
    api.patch = jest.fn().mockResolvedValue({ data: { id: 3, email: 'a@b.co' } });
    const { saveBirthDate } = jest.requireActual('../authService') as typeof import('../authService');
    expect((await saveBirthDate('1990-02-02')).dateOfBirth).toBe('1990-02-02');
  });
});
