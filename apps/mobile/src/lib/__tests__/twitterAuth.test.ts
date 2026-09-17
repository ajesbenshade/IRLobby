import {
  formatTwitterCallbackError,
  getTwitterMobileRedirectUri,
  isTwitterAuthCallbackUrl,
  MOBILE_TWITTER_REDIRECT_URI,
  parseTwitterAuthCallbackUrl,
  TWITTER_CANCELLED_MESSAGE,
  TWITTER_MISSING_ACCESS_MESSAGE,
  TWITTER_NO_CALLBACK_MESSAGE,
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

  it('surfaces the raw OAuth error param and description', () => {
    const parsed = parseTwitterAuthCallbackUrl(
      'irlobby://auth/twitter?error=redirect_uri_mismatch&error_description=Callback%20URL%20mismatch',
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('callback_error');
      expect(parsed.code).toBe('redirect_uri_mismatch');
      expect(parsed.error).toContain('redirect_uri_mismatch');
      expect(parsed.error).toContain('Callback URL mismatch');
      expect(parsed.error).toContain(TWITTER_PRODUCTION_CALLBACK_URL);
    }
  });

  it('maps access_denied to cancelled copy while keeping the raw code', () => {
    const parsed = parseTwitterAuthCallbackUrl(
      'irlobby://auth/twitter?error=access_denied',
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('cancelled');
      expect(parsed.error).toContain(TWITTER_CANCELLED_MESSAGE);
      expect(parsed.error).toContain('access_denied');
    }
  });

  it('parses error params from the URL hash', () => {
    const parsed = parseTwitterAuthCallbackUrl(
      'irlobby://auth/twitter#error=unauthorized_client',
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.code).toBe('unauthorized_client');
      expect(parsed.error).toContain('unauthorized_client');
    }
  });

  it('rejects a callback without an access token as MISSING_ACCESS', () => {
    const parsed = parseTwitterAuthCallbackUrl(
      `irlobby://auth/twitter?user=${encodeURIComponent(JSON.stringify({ id: 1 }))}`,
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('missing_access');
      expect(parsed.code).toBe('MISSING_ACCESS');
      expect(parsed.error).toBe(TWITTER_MISSING_ACCESS_MESSAGE);
      expect(parsed.error).toContain('MISSING_ACCESS');
      expect(parsed.error).toContain(
        'https://api.irlobby.com/api/auth/twitter/callback/',
      );
    }
  });

  it('explains a non-callback URL as a deep-link miss, not a cancel', () => {
    const parsed = parseTwitterAuthCallbackUrl('https://example.com/not-x');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reason).toBe('not_callback');
      expect(parsed.error).toBe(TWITTER_NO_CALLBACK_MESSAGE);
    }
  });

  it('formats portal vs cancel errors distinctly', () => {
    expect(formatTwitterCallbackError('access_denied')).toContain('cancelled');
    expect(formatTwitterCallbackError('redirect_uri_mismatch')).toContain(
      'rejected',
    );
    expect(formatTwitterCallbackError('server_error', 'try again')).toContain(
      'server_error: try again',
    );
  });
});
