import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { HTTP_METHODS, HttpMethod } from "@/types/api";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

interface ApiRequestOptions {
  method?: string;
  body?: unknown;
}

type ApiRequestArgs =
  | [HttpMethod, string, unknown?]
  | [string, ApiRequestOptions?];

const isApiRequestOptions = (value: unknown): value is ApiRequestOptions =>
  typeof value === 'object' && value !== null;

const toHttpMethod = (value: unknown): HttpMethod | null => {
  if (typeof value === 'string') {
    const upper = value.toUpperCase() as HttpMethod;
    if ((HTTP_METHODS as readonly string[]).includes(upper)) {
      return upper;
    }
  }
  return null;
};

const buildRequestBody = (payload: unknown): string | undefined => {
  if (payload === undefined) return undefined;
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
};

export function apiRequest(method: HttpMethod, url: string, data?: unknown): Promise<Response>;
export function apiRequest(url: string, options?: ApiRequestOptions): Promise<Response>;
export async function apiRequest(...args: ApiRequestArgs): Promise<Response> {
  // Accept two call shapes used in the codebase:
  // 1) apiRequest(method, url, data?)
  // 2) apiRequest(url, { method, body })
  let method: HttpMethod = 'GET';
  let url: string;
  let data: unknown;

  const [firstArg] = args;
  if (typeof firstArg !== 'string') {
    throw new Error('Invalid arguments to apiRequest');
  }

  if (args.length > 1 && typeof args[1] === 'string') {
    const normalizedMethod = toHttpMethod(firstArg);
    if (!normalizedMethod) {
      throw new Error(`Invalid HTTP method: ${String(firstArg)}`);
    }
    method = normalizedMethod;
    url = args[1];
    data = args[2];
  } else {
    url = firstArg;
    const options = args[1];
    if (options !== undefined) {
      if (!isApiRequestOptions(options)) {
        throw new Error('Invalid apiRequest options');
      }

      if (options.method !== undefined) {
        const normalizedMethod = toHttpMethod(options.method);
        if (!normalizedMethod) {
          throw new Error(`Invalid HTTP method: ${String(options.method)}`);
        }
        method = normalizedMethod;
      }

      data = options.body;
    }
  }

  // Prepend base URL for production
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  if (baseUrl && !url.startsWith('http')) {
    url = `${baseUrl}${url}`;
  }

  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {};

  if (data !== undefined && data !== null && typeof data !== 'string') {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('Sending Authorization header:', `Bearer ${token}`);
    console.log('Token length:', token.length);
    console.log('Token starts with:', token.substring(0, 20));
  }

  console.log(`Making ${method} request to ${url} with token: ${token ? 'Yes' : 'No'}`);
  console.log('Request headers:', headers);
  console.log('Request body:', data);

  try {
    const requestBody = buildRequestBody(data);

    const res = await fetch(url, {
      method,
      headers,
      body: requestBody,
      // credentials: 'include',  // Remove credentials for production CORS
    });

    console.log('Response status:', res.status);
    console.log('Response headers:', Object.fromEntries(res.headers.entries()));

    // Handle 401 errors quietly for auth endpoints
    if (res.status === 401 && (url.includes('/api/users/profile/') || url.includes('/api/users/auth/status/'))) {
      console.warn('Authentication required for:', url);
      // Don't throw error for auth endpoints - return response as-is for proper handling
      return res;
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API request failed for ${method} ${url}:`, error);
    if (error instanceof Error) {
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // If we get a 401 and have a refresh token, try to refresh
    if (error instanceof Error && error.message.includes('401') && localStorage.getItem('refreshToken')) {
      console.log('Attempting token refresh...');
      try {
        const refreshResponse = await fetch(`${baseUrl}/api/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: localStorage.getItem('refreshToken') })
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          localStorage.setItem('authToken', refreshData.access);
          
          // Retry the original request with new token
          console.log('Token refreshed, retrying request...');
          const retryHeaders = { ...headers };
          retryHeaders['Authorization'] = `Bearer ${refreshData.access}`;
          
          const retryBody = buildRequestBody(data);

          const retryRes = await fetch(url, {
            method,
            headers: retryHeaders,
            body: retryBody,
            // credentials: 'include',  // Remove credentials for production CORS
          });
          
          await throwIfResNotOk(retryRes);
          return retryRes;
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
    }
    
    // Return a mock response for development/demo purposes
    if (method === 'GET' && url.includes('/api/auth/twitter/url/')) {
      return new Response(JSON.stringify({ auth_url: '#' }), { status: 200 });
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn =
  (options: { on401: UnauthorizedBehavior }): QueryFunction<unknown> =>
  async ({ queryKey }) => {
    const unauthorizedBehavior = options.on401;
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {};

    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (typeof queryKey[0] !== 'string') {
      throw new Error('Query key must start with a string URL');
    }

    let url = queryKey[0];
    // Prepend base URL for production
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    if (baseUrl && !url.startsWith('http')) {
      url = `${baseUrl}${url}`;
    }

    console.log(`Query request to ${url} with token: ${token ? 'Yes' : 'No'}`);

    try {
      const res = await fetch(url, {
        headers,
        // credentials: 'include',  // Remove credentials for production CORS
      });

      if (unauthorizedBehavior === 'returnNull' && res.status === 401) return null;

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      console.warn(`Query request failed for ${url}:`, error);
      // Return null for failed requests to prevent app crashes
      if (unauthorizedBehavior === 'returnNull') return null;
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        // Retry up to 2 times for network errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'offlineFirst', // Better for mobile
    },
    mutations: {
      retry: false,
      networkMode: 'offlineFirst',
    },
  },
});
