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
