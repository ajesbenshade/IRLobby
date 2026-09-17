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

export const TWITTER_PORTAL_CALLBACK_HINT = `Confirm the X Developer Portal callback URL includes ${TWITTER_PRODUCTION_CALLBACK_URL}`;

export const TWITTER_CANCELLED_MESSAGE =
  'X sign-in was cancelled. No account was connected.';

export const TWITTER_NO_CALLBACK_MESSAGE =
  'X sign-in did not return to IRLobby (no callback). If you didn’t cancel, the app never received irlobby://auth/twitter — often a portal reject that never redirected, or a deep-link miss.';

export const TWITTER_MISSING_ACCESS_MESSAGE =
  'X sign-in did not return an access token (MISSING_ACCESS). This is usually a Twitter Developer Portal callback allowlist / env mismatch, not a missing deep link. Confirm the X app callback URL includes https://api.irlobby.com/api/auth/twitter/callback/ and that the app opened irlobby://auth/twitter. Try again in a standalone build (not Expo Go).';

export const TWITTER_MISSING_USER_MESSAGE =
  'X sign-in response is missing user details.';

export const TWITTER_INVALID_USER_MESSAGE =
  'X sign-in response was not valid.';

export function isTwitterCancelledError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message === TWITTER_CANCELLED_MESSAGE ||
    error.message.startsWith(`${TWITTER_CANCELLED_MESSAGE} (`)
  );
}

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
      url.startsWith(`${MOBILE_TWITTER_REDIRECT_URI}?`) ||
      url.startsWith(`${MOBILE_TWITTER_REDIRECT_URI}#`)
    );
  }
}

export type TwitterAuthFailureReason =
  | 'not_callback'
  | 'callback_error'
  | 'cancelled'
  | 'missing_access'
  | 'missing_user'
  | 'invalid_user';

export type TwitterAuthCallback =
  | { ok: true; access: string; refresh?: string; user: AuthUser }
  | {
      ok: false;
      error: string;
      reason: TwitterAuthFailureReason;
      code?: string;
    };

const CANCELLED_ERROR_CODES = new Set([
  'access_denied',
  'user_denied',
  'cancelled',
  'canceled',
  'login_cancelled',
]);

const PORTAL_ERROR_CODES = new Set([
  'redirect_uri_mismatch',
  'invalid_request',
  'unauthorized_client',
  'invalid_client',
  'unsupported_response_type',
  'invalid_redirect_uri',
  'callback_uri_not_allowed',
]);

const readParam = (params: URLSearchParams, key: string): string | null => {
  const value = params.get(key);
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export function getTwitterCallbackSearchParams(url: string): URLSearchParams {
  try {
    const parsed = new URL(url);
    const fromSearch = parsed.searchParams;
    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    const fromHash = new URLSearchParams(hash);
    if ([...fromSearch.keys()].length === 0 && [...fromHash.keys()].length > 0) {
      return fromHash;
    }
    const merged = new URLSearchParams(fromHash);
    fromSearch.forEach((value, key) => {
      merged.set(key, value);
    });
    return merged;
  } catch {
    const queryIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');
    if (queryIndex >= 0) {
      const queryEnd = hashIndex > queryIndex ? hashIndex : url.length;
      return new URLSearchParams(url.slice(queryIndex + 1, queryEnd));
    }
    if (hashIndex >= 0) {
      return new URLSearchParams(url.slice(hashIndex + 1));
    }
    return new URLSearchParams();
  }
}

export function formatTwitterCallbackError(
  error: string,
  errorDescription?: string | null,
): string {
  const code = error.trim();
  const description = errorDescription?.trim();
  const detail =
    description && description.toLowerCase() !== code.toLowerCase()
      ? `${code}: ${description}`
      : code;
  const normalized = code.toLowerCase();

  if (CANCELLED_ERROR_CODES.has(normalized)) {
    return `${TWITTER_CANCELLED_MESSAGE} (${detail})`;
  }

  if (
    PORTAL_ERROR_CODES.has(normalized) ||
    /redirect_uri|callback/i.test(detail)
  ) {
    return `X sign-in was rejected (${detail}). ${TWITTER_PORTAL_CALLBACK_HINT}.`;
  }

  return `X sign-in failed (${detail}). ${TWITTER_PORTAL_CALLBACK_HINT} if this keeps happening.`;
}

export function parseTwitterAuthCallbackUrl(url: string): TwitterAuthCallback {
  if (!isTwitterAuthCallbackUrl(url)) {
    return {
      ok: false,
      error: TWITTER_NO_CALLBACK_MESSAGE,
      reason: 'not_callback',
    };
  }

  const params = getTwitterCallbackSearchParams(url);
  const error = readParam(params, 'error');
  const errorDescription =
    readParam(params, 'error_description') ?? readParam(params, 'errorDescription');

  if (error) {
    const normalized = error.toLowerCase();
    return {
      ok: false,
      error: formatTwitterCallbackError(error, errorDescription),
      reason: CANCELLED_ERROR_CODES.has(normalized) ? 'cancelled' : 'callback_error',
      code: error,
    };
  }

  const access = readParam(params, 'access');
  const refresh = readParam(params, 'refresh') ?? undefined;
  const userRaw = readParam(params, 'user');

  if (!access) {
    return {
      ok: false,
      error: TWITTER_MISSING_ACCESS_MESSAGE,
      reason: 'missing_access',
      code: 'MISSING_ACCESS',
    };
  }

  if (!userRaw) {
    return {
      ok: false,
      error: TWITTER_MISSING_USER_MESSAGE,
      reason: 'missing_user',
    };
  }

  try {
    const user = JSON.parse(userRaw) as AuthUser;
    if (!user || typeof user !== 'object') {
      throw new Error('invalid user payload');
    }
    return { ok: true, access, refresh, user };
  } catch {
    return {
      ok: false,
      error: TWITTER_INVALID_USER_MESSAGE,
      reason: 'invalid_user',
    };
  }
}
