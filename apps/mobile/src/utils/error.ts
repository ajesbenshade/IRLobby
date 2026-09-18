import axios from 'axios';

const DEFAULT_FALLBACK = 'Something went wrong. Please try again.';
const SESSION_EXPIRED_MESSAGE = 'Your session expired. Sign in again to continue.';
const UNAVAILABLE_MESSAGE = 'This isn’t available yet. Try again later.';
const UNREACHABLE_MESSAGE = 'Unable to reach API right now. Please try again.';

const UNAUTHENTICATED_DETAILS = new Set([
  'authentication credentials were not provided.',
  'invalid token.',
  'token is invalid or expired',
]);

const looksLikeHtml = (value: string) => {
  const trimmed = value.trim();
  return (
    trimmed.startsWith('<') ||
    /<!doctype/i.test(trimmed) ||
    /<\/?(html|head|body|h1|p)\b/i.test(trimmed)
  );
};

const isUnauthenticatedMessage = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (UNAUTHENTICATED_DETAILS.has(normalized)) {
    return true;
  }
  return (
    normalized.includes('not valid for any token type') ||
    normalized.includes('invalid or expired refresh token')
  );
};

const sanitizeServerMessage = (value: string, status: number | undefined, fallback: string) => {
  if (looksLikeHtml(value)) {
    if (status === 404 || status === 501) {
      return UNAVAILABLE_MESSAGE;
    }
    return fallback;
  }
  if (isUnauthenticatedMessage(value)) {
    return SESSION_EXPIRED_MESSAGE;
  }
  return value;
};

const firstObjectMessage = (responseData: object) => {
  if (typeof (responseData as { detail?: string }).detail === 'string') {
    return (responseData as { detail?: string }).detail;
  }
  if (typeof (responseData as { error?: string }).error === 'string') {
    return (responseData as { error?: string }).error;
  }
  const firstEntry = Object.values(responseData)[0];
  if (Array.isArray(firstEntry) && typeof firstEntry[0] === 'string') {
    return firstEntry[0];
  }
  return null;
};

export const getErrorMessage = (
  error: unknown,
  fallback = DEFAULT_FALLBACK,
) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const responseData = error.response?.data;

    if (status === 503) {
      if (responseData && typeof responseData === 'object') {
        const serverMessage = firstObjectMessage(responseData);
        if (serverMessage) {
          return sanitizeServerMessage(serverMessage, status, fallback);
        }
      }
      return UNREACHABLE_MESSAGE;
    }
    if (typeof responseData === 'string') {
      return sanitizeServerMessage(responseData, status, fallback);
    }
    if (responseData && typeof responseData === 'object') {
      const serverMessage = firstObjectMessage(responseData);
      if (serverMessage) {
        return sanitizeServerMessage(serverMessage, status, fallback);
      }
    }
    if (status === 401) {
      return SESSION_EXPIRED_MESSAGE;
    }
    if (status === 404) {
      return fallback === DEFAULT_FALLBACK ? UNAVAILABLE_MESSAGE : fallback;
    }
    if (typeof error.message === 'string' && error.message && !looksLikeHtml(error.message)) {
      return error.message;
    }
  } else if (error instanceof Error && !looksLikeHtml(error.message)) {
    return error.message;
  }
  return fallback;
};
