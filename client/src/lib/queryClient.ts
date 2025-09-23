import { QueryClient, QueryFunction } from '@tanstack/react-query';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  method?: HttpMethod | string;
  body?: unknown;
}

type ApiRequestArgs = [HttpMethod, string, unknown?] | [string, ApiRequestOptions?];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AUTH_401_BYPASS_PATHS = ['/api/users/profile/', '/api/users/auth/status/'] as const;
const HTTP_METHODS: ReadonlySet<HttpMethod> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

let refreshPromise: Promise<string | null> | null = null;

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch (error) {
    console.warn('Failed to decode JWT payload', error);
    return null;
  }
}

function getTokenExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }

  const exp = payload.exp;
  if (typeof exp !== 'number') {
    return null;
  }

  return exp * 1000;
}

function shouldPersistRefreshTokenLocally(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.protocol !== 'https:';
}


const isApiRequestOptions = (value: unknown): value is ApiRequestOptions =>
  typeof value === 'object' && value !== null;

function joinBaseUrl(baseUrl: string, url: string) {
  if (!baseUrl || url.startsWith('http')) {
    return url;
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  if (url.startsWith('/')) {
    return `${normalizedBase}${url}`;
  }
  return `${normalizedBase}/${url}`;
}

function resolveUrl(url: string) {
  return joinBaseUrl(API_BASE_URL, url);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function refreshAccessToken() {
  const storedRefreshToken = localStorage.getItem('refreshToken');

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const payload = storedRefreshToken ? { refresh: storedRefreshToken } : {};
      const res = await fetch(resolveUrl('/api/auth/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }

      const data = await res.json();
      if (typeof data.access !== 'string') {
        throw new Error('Token refresh response missing access token');
      }

      localStorage.setItem('authToken', data.access);
      if (shouldPersistRefreshTokenLocally()) {
        if (typeof data.refresh === 'string') {
          localStorage.setItem('refreshToken', data.refresh);
        }
      } else if (storedRefreshToken) {
        localStorage.removeItem('refreshToken');
      }
      return data.access as string;
    } catch (error) {
      console.error('Token refresh failed:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest(...args: ApiRequestArgs): Promise<Response> {
  let method: HttpMethod = 'GET';
  let url: string;
  let requestData: unknown;
  let additionalFetchOptions: Omit<RequestInit, 'body' | 'method'> = {};

  const headers: Record<string, string> = {};

  if (
    typeof args[0] === 'string' &&
    typeof args[1] === 'string' &&
    HTTP_METHODS.has((args[0] as string).toUpperCase() as HttpMethod)
  ) {
    method = (args[0] as string).toUpperCase() as HttpMethod;
    url = args[1];
    requestData = args[2];
  } else if (typeof args[0] === 'string') {
    url = args[0];

    if (isApiRequestOptions(args[1])) {
      const {
        headers: optionHeaders,
        method: optionMethod,
        body: optionBody,
        ...restOptions
      } = args[1];
      additionalFetchOptions = restOptions;

      const normalizedMethod = optionMethod ? String(optionMethod).toUpperCase() : undefined;
      if (normalizedMethod && HTTP_METHODS.has(normalizedMethod as HttpMethod)) {
        method = normalizedMethod as HttpMethod;
      }

      if (optionBody !== undefined) {
        try {
          requestData = typeof optionBody === 'string' ? JSON.parse(optionBody) : optionBody;
        } catch {
          requestData = optionBody;
        }
      }

      if (optionHeaders) {
        const headerEntries = new Headers(optionHeaders as HeadersInit);
        headerEntries.forEach((value, key) => {
          headers[key] = value;
        });
      }
    }
  } else {
    throw new Error('Invalid arguments to apiRequest');
  }

  const resolvedUrl = resolveUrl(url);
  let token = localStorage.getItem('authToken');

  const ensureFreshToken = async () => {
    if (!token) {
      return;
    }

    const expiryMs = getTokenExpiryMs(token);
    if (!expiryMs) {
      return;
    }

    const timeUntilExpiry = expiryMs - Date.now();
    if (timeUntilExpiry <= TOKEN_REFRESH_BUFFER_MS) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        token = refreshedToken;
      } else {
        token = null;
      }
    }
  };

  const executeRequest = async (overrideToken?: string) => {
    const requestHeaders: Record<string, string> = { ...headers };
    const authToken = overrideToken ?? token;
    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    if (requestData !== undefined) {
      const hasContentTypeHeader = Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'content-type');
      if (!hasContentTypeHeader) {
        requestHeaders['Content-Type'] = 'application/json';
      }
    }

    const fetchOptions: RequestInit = {
      ...additionalFetchOptions,
      method,
      headers: requestHeaders,
      body: requestData !== undefined ? JSON.stringify(requestData) : undefined,
      credentials: additionalFetchOptions.credentials ?? 'include',
    };

    return fetch(resolvedUrl, fetchOptions);
  };

  try {
    await ensureFreshToken();
    let response = await executeRequest();

    if (response.status === 401) {
      if (AUTH_401_BYPASS_PATHS.some((path) => resolvedUrl.includes(path))) {
        return response;
      }

      const newToken = await refreshAccessToken();
      if (newToken) {
        token = newToken;
        response = await executeRequest(newToken);
      } else {
        token = null;
      }
    }

    await throwIfResNotOk(response);
    return response;
  } catch (error) {
    console.error(`API request failed for ${method} ${resolvedUrl}:`, error);
    if (error instanceof Error) {
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    if (method === 'GET' && resolvedUrl.includes('/api/auth/twitter/url/')) {
      return new Response(JSON.stringify({ auth_url: '#' }), { status: 200 });
    }
    throw error;
  }
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn =
  (options: { on401: UnauthorizedBehavior }): QueryFunction<unknown> =>
  async ({ queryKey }) => {
    const unauthorizedBehavior = options.on401;
    let token = localStorage.getItem('authToken');

    if (token) {
      const expiryMs = getTokenExpiryMs(token);
      if (expiryMs && expiryMs - Date.now() <= TOKEN_REFRESH_BUFFER_MS) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          token = refreshedToken;
        } else {
          token = null;
        }
      }
    }

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = queryKey[0] as string;
    const resolvedUrl = resolveUrl(url);

    try {
      const res = await fetch(resolvedUrl, {
        headers,
        credentials: 'include',
      });

      if (unauthorizedBehavior === 'returnNull' && res.status === 401) return null;

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.warn(`Query request failed for ${resolvedUrl}:`, error);
      if (unauthorizedBehavior === 'returnNull') return null;
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: false,
      networkMode: 'offlineFirst',
    },
  },
});
