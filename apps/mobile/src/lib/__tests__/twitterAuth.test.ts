import {
  getTwitterMobileRedirectUri,
  isTwitterAuthCallbackUrl,
  MOBILE_TWITTER_REDIRECT_URI,
  parseTwitterAuthCallbackUrl,
  TWITTER_PRODUCTION_CALLBACK_URL,
} from '../twitterAuth';

describe('twitterAuth helpers', () => {
  it('always uses the irlobby://auth/twitter deep link', () => {
    expect(getTwitterMobileRedirectUri()).toBe('irlobby://auth/twitter');
    expect(MOBILE_TWITTER_REDIRECT_URI).toBe('irlobby://auth/twitter');
  });

  it('documents the production backend callback, not the apex stub', () => {
    expect(TWITTER_PRODUCTION_CALLBACK_URL).toBe(
      'https://api.irlobby.com/api/auth/twitter/callback/',
    );
    expect(TWITTER_PRODUCTION_CALLBACK_URL).not.toContain('://irlobby.com/auth/');
    expect(TWITTER_PRODUCTION_CALLBACK_URL).not.toBe(
      'https://api.irlobby.com/auth/twitter/callback',
    );
  });

  it('accepts the mobile callback scheme with tokens', () => {
    expect(
      isTwitterAuthCallbackUrl('irlobby://auth/twitter?access=abc&user=%7B%7D'),
    ).toBe(true);
    expect(isTwitterAuthCallbackUrl('https://irlobby.com/auth/twitter/callback')).toBe(
      false,
    );
    expect(
      isTwitterAuthCallbackUrl('https://api.irlobby.com/auth/twitter/callback'),
    ).toBe(false);
  });

  it('parses access, refresh, and user from the deep link', () => {
    const user = { id: 7, email: 'alex@irlobby.com' };
    const url = `irlobby://auth/twitter?access=tok-a&refresh=tok-r&user=${encodeURIComponent(
      JSON.stringify(user),
    )}`;

    expect(parseTwitterAuthCallbackUrl(url)).toEqual({
      ok: true,
      access: 'tok-a',
      refresh: 'tok-r',
      user,
    });
  });

  it('surfaces OAuth error query params', () => {
    expect(
      parseTwitterAuthCallbackUrl('irlobby://auth/twitter?error=access_denied'),
    ).toEqual({ ok: false, error: 'access_denied' });
  });

  it('rejects a callback without an access token', () => {
    const parsed = parseTwitterAuthCallbackUrl(
      `irlobby://auth/twitter?user=${encodeURIComponent(JSON.stringify({ id: 1 }))}`,
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain(
        'https://api.irlobby.com/api/auth/twitter/callback/',
      );
    }
  });
});
