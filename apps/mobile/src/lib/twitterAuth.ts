import type { AuthUser } from '../types/auth';

/** Mobile deep link X should return to after the backend exchange. */
export const MOBILE_TWITTER_REDIRECT_URI = 'irlobby://auth/twitter';

/**
 * Production X Developer Portal callback. Mobile never sends users to the
 * apex `https://irlobby.com/auth/twitter/callback` stub or to
 * `https://api.irlobby.com/auth/twitter/callback` (missing `/api/`).
 */
export const TWITTER_PRODUCTION_CALLBACK_URL =
  'https://api.irlobby.com/api/auth/twitter/callback/';

export function getTwitterMobileRedirectUri(): string {
  return MOBILE_TWITTER_REDIRECT_URI;
}

const normalizeHostPath = (hostname: string, pathname: string) =>
  `${hostname}${pathname}`.replace(/\/+$/, '') || pathname.replace(/\/+$/, '');

export function isTwitterAuthCallbackUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'irlobby:') {
      return false;
    }
    const hostPath = normalizeHostPath(parsed.hostname, parsed.pathname);
    return hostPath === 'auth/twitter' || hostPath === '/auth/twitter';
  } catch {
    return (
      url === MOBILE_TWITTER_REDIRECT_URI ||
      url.startsWith(`${MOBILE_TWITTER_REDIRECT_URI}?`)
    );
  }
}

export type TwitterAuthCallback =
  | { ok: true; access: string; refresh?: string; user: AuthUser }
  | { ok: false; error: string };

const MISSING_ACCESS_MESSAGE =
  'X/Twitter sign-in did not return an access token. Confirm the Twitter app callback URL includes https://api.irlobby.com/api/auth/twitter/callback/ and try again in a standalone build (not Expo Go).';

export function parseTwitterAuthCallbackUrl(url: string): TwitterAuthCallback {
  if (!isTwitterAuthCallbackUrl(url)) {
    return {
      ok: false,
      error: 'X/Twitter sign-in did not return to the app.',
    };
  }

  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    const queryIndex = url.indexOf('?');
    params = new URLSearchParams(queryIndex >= 0 ? url.slice(queryIndex + 1) : '');
  }

  const error = params.get('error');
  if (error) {
    return { ok: false, error };
  }

  const access = params.get('access');
  const refresh = params.get('refresh') ?? undefined;
  const userRaw = params.get('user');

  if (!access) {
    return { ok: false, error: MISSING_ACCESS_MESSAGE };
  }

  if (!userRaw) {
    return {
      ok: false,
      error: 'Twitter sign-in response is missing user details.',
    };
  }

  try {
    const user = JSON.parse(userRaw) as AuthUser;
    if (!user || typeof user !== 'object') {
      throw new Error('invalid user payload');
    }
    return { ok: true, access, refresh, user };
  } catch {
    return { ok: false, error: 'Twitter sign-in response was not valid.' };
  }
}
