import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import { config } from '@constants/config';
import { authStorage, getAccessToken, getRefreshToken } from './authStorage';

import type { AuthTokens } from '../types/auth';

const API_TIMEOUT = 15000;

let isRefreshing = false;
let pendingRequests: Array<(token: string | null) => void> = [];

const queuePendingRequest = (callback: (token: string | null) => void) => {
  pendingRequests.push(callback);
};

const resolvePendingRequests = (token: string | null) => {
  pendingRequests.forEach((callback) => callback(token));
  pendingRequests = [];
};

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
      `${config.apiBaseUrl}/api/auth/token/refresh/`,
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

    const resolvedAccessToken = typeof directAccess === 'string' ? directAccess : typeof access === 'string' ? access : '';
    const resolvedRefreshToken =
      typeof directRefresh === 'string'
        ? directRefresh
        : typeof refresh === 'string'
          ? refresh
          : refreshToken ?? undefined;

    const tokens: AuthTokens = {
      accessToken: resolvedAccessToken,
      refreshToken: resolvedRefreshToken,
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
    await authStorage.clearTokens();
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
    const token = await getAccessToken();
    if (token && request.headers) {
      request.headers.Authorization = `Bearer ${token}`;
    }
    return request;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await refreshAccessToken();

      if (newToken) {
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newToken}`,
        };
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

export { api, refreshAccessToken };
