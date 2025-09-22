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

let refreshPromise: Promise<string | null> | null = null;

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
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(resolveUrl('/api/auth/token/refresh/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }

      const data = await res.json();
      localStorage.setItem('authToken', data.access);
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
  const token = localStorage.getItem('authToken');

  const executeRequest = async (overrideToken?: string) => {
    const requestHeaders: Record<string, string> = { ...headers };
    const authToken = overrideToken ?? token;
    if (authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    return fetch(resolvedUrl, {
      ...additionalFetchOptions,
      method,
      headers: requestHeaders,
      body: requestData !== undefined ? JSON.stringify(requestData) : undefined,
    });
  };

  try {
    let response = await executeRequest();

    if (response.status === 401) {
      if (AUTH_401_BYPASS_PATHS.some((path) => resolvedUrl.includes(path))) {
        return response;
      }

      const newToken = await refreshAccessToken();
      if (newToken) {
        response = await executeRequest(newToken);
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
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {};

    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = queryKey[0] as string;
    const resolvedUrl = resolveUrl(url);

    try {
      const res = await fetch(resolvedUrl, {
        headers,
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
