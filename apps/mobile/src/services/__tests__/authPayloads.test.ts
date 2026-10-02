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
