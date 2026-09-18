import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { API_ROUTES } from '@shared/schema';

import { config } from '@constants/config';
import { authStorage, getAccessToken, getRefreshToken } from './authStorage';

import type { AuthTokens } from '../types/auth';

const API_TIMEOUT = 15000;

const SKIP_REFRESH_PATHS = [
  API_ROUTES.AUTH_REFRESH,
  API_ROUTES.AUTH_TOKEN,
  API_ROUTES.USER_LOGIN,
  API_ROUTES.USER_REGISTER,
  API_ROUTES.AUTH_GOOGLE_MOBILE,
  API_ROUTES.AUTH_APPLE_MOBILE,
  API_ROUTES.AUTH_TWITTER_CALLBACK,
  API_ROUTES.AUTH_REQUEST_PASSWORD_RESET,
  API_ROUTES.AUTH_RESET_PASSWORD,
];

// Stale/invalid JWTs on AllowAny auth endpoints make simplejwt return 401
// before the view runs. Never attach Authorization when signing in.
const SKIP_AUTH_HEADER_PATHS = [
  API_ROUTES.AUTH_TOKEN,
  API_ROUTES.USER_LOGIN,
  API_ROUTES.USER_REGISTER,
  API_ROUTES.AUTH_GOOGLE_MOBILE,
  API_ROUTES.AUTH_APPLE_MOBILE,
  API_ROUTES.AUTH_TWITTER_URL,
  API_ROUTES.AUTH_TWITTER_STATUS,
  API_ROUTES.AUTH_TWITTER_CALLBACK,
  API_ROUTES.AUTH_REQUEST_PASSWORD_RESET,
  API_ROUTES.AUTH_RESET_PASSWORD,
];

let isRefreshing = false;
let pendingRequests: Array<(token: string | null) => void> = [];
let onSessionExpired: (() => void) | null = null;

export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onSessionExpired = handler;
};

const queuePendingRequest = (callback: (token: string | null) => void) => {
  pendingRequests.push(callback);
};

const resolvePendingRequests = (token: string | null) => {
  pendingRequests.forEach((callback) => callback(token));
  pendingRequests = [];
};

const expireSession = async () => {
  await authStorage.clearTokens();
  onSessionExpired?.();
};

const getHeaderValue = (
  headers: AxiosRequestConfig['headers'] | undefined,
  name: string,
) => {
  if (!headers) {
    return undefined;
  }
  if (typeof (headers as AxiosHeaders).get === 'function') {
    const value = (headers as AxiosHeaders).get(name);
    return typeof value === 'string' && value ? value : undefined;
  }
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  return typeof value === 'string' && value ? value : undefined;
};

const setAuthorizationHeader = (
  headers: AxiosRequestConfig['headers'] | undefined,
  token: string,
): AxiosHeaders => {
  const nextHeaders =
    headers instanceof AxiosHeaders ? headers : new AxiosHeaders(headers as never);
  nextHeaders.set('Authorization', `Bearer ${token}`);
  return nextHeaders;
};

const urlMatchesPath = (url: string | undefined, paths: string[]) =>
  Boolean(url && paths.some((route) => url.includes(route)));

const shouldSkipRefresh = (url?: string) => urlMatchesPath(url, SKIP_REFRESH_PATHS);

export const shouldAttachAccessToken = (url?: string) =>
  !urlMatchesPath(url, SKIP_AUTH_HEADER_PATHS);

const refreshAccessToken = async (): Promise<string | null> => {
  if (isRefreshing) {
    return new Promise((resolve) => {
      queuePendingRequest(resolve);
    });
  }

  isRefreshing = true;
  try {
    const refreshToken = await getRefreshToken();
    const payload = refreshToken ? { refresh: refreshToken } : {};

    const response = await axios.post<Partial<AuthTokens> & { access?: string; refresh?: string }>(
      `${config.apiBaseUrl}${API_ROUTES.AUTH_REFRESH}`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        timeout: API_TIMEOUT,
      },
    );

    const {
      accessToken: directAccess,
      refreshToken: directRefresh,
      expiresIn,
      access,
      refresh,
    } = response.data;

    const resolvedAccessToken =
      typeof directAccess === 'string' ? directAccess : typeof access === 'string' ? access : '';
    const resolvedRefreshToken =
      typeof directRefresh === 'string'
        ? directRefresh
        : typeof refresh === 'string'
          ? refresh
          : refreshToken ?? undefined;

    const tokens: AuthTokens = {
      accessToken: resolvedAccessToken,
      refreshToken: resolvedRefreshToken,
      access: resolvedAccessToken,
      refresh: resolvedRefreshToken,
      expiresIn,
    };

    if (!resolvedAccessToken) {
      throw new Error('Token refresh response missing access token');
    }

    await authStorage.setTokens(tokens);
    resolvePendingRequests(resolvedAccessToken);
    return resolvedAccessToken;
  } catch (error) {
    console.warn('[apiClient] Token refresh failed', error);
    await expireSession();
    resolvePendingRequests(null);
    return null;
  } finally {
    isRefreshing = false;
  }
};

const api: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: API_TIMEOUT,
  withCredentials: true,
});

api.interceptors.request.use(
  async (request) => {
    if (!shouldAttachAccessToken(request.url)) {
      return request;
    }
    const token = await getAccessToken();
    if (token) {
      request.headers = setAuthorizationHeader(request.headers, token);
    }
    return request;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !shouldSkipRefresh(originalRequest.url)
    ) {
      originalRequest._retry = true;
      const existingToken = await getAccessToken();
      const sentAuthorization = getHeaderValue(originalRequest.headers, 'Authorization');

      if (existingToken && !sentAuthorization) {
        originalRequest.headers = setAuthorizationHeader(originalRequest.headers, existingToken);
        return api(originalRequest);
      }

      const newToken = await refreshAccessToken();

      if (newToken) {
        originalRequest.headers = setAuthorizationHeader(originalRequest.headers, newToken);
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

export { api, refreshAccessToken };
