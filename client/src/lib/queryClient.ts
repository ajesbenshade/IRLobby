import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(...args: any[]): Promise<Response> {
  // Accept two call shapes used in the codebase:
  // 1) apiRequest(method, url, data?)
  // 2) apiRequest(url, { method, body })
  const httpMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

  let method = 'GET';
  let url: string;
  let data: any = undefined;

  if (typeof args[0] === 'string' && typeof args[1] === 'string' && httpMethods.has((args[0] as string).toUpperCase())) {
    // apiRequest(method, url, data)
    method = (args[0] as string).toUpperCase();
    url = args[1] as string;
    data = args[2];
  } else if (typeof args[0] === 'string') {
    // apiRequest(url, options)
    url = args[0] as string;
    const opts = args[1] || {};
    method = (opts.method || 'GET').toUpperCase();
    // support both JSON-stringified body and plain objects
    if (opts.body !== undefined) {
      try {
        data = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
      } catch {
        data = opts.body;
      }
    }
  } else {
    throw new Error('Invalid arguments to apiRequest');
  }

  // Prepend base URL for production
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  if (baseUrl && !url.startsWith('http')) {
    url = `${baseUrl}${url}`;
  }

  const headers: Record<string, string> = {};

  if (data !== undefined && data !== null) {
    headers['Content-Type'] = 'application/json';
  }

  // Add Authorization header with token from localStorage
  let token: string | null = null;
  try {
    token = localStorage.getItem('authToken');
    // Fallback to sessionStorage for Safari private mode
    if (!token) {
      token = sessionStorage.getItem('authToken');
    }
  } catch (e) {
    // Safari private browsing mode may throw errors
    console.warn('localStorage not available, trying sessionStorage:', e);
    try {
      token = sessionStorage.getItem('authToken');
    } catch (e2) {
      console.warn('sessionStorage also not available:', e2);
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Safari-specific headers to avoid CORS issues
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    headers['Cache-Control'] = 'no-cache';
    headers['Pragma'] = 'no-cache';
  }

  console.log(`Making ${method} request to ${url}`);
  console.log('Request headers:', headers);
  console.log('Request body:', data);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data !== undefined ? JSON.stringify(data) : undefined,
      // Removed credentials: 'include' to avoid cookie issues on iPhone
    });

    console.log('Response status:', res.status);
    console.log('Response headers:', Object.fromEntries(res.headers.entries()));

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API request failed for ${method} ${url}:`, error);
    if (error instanceof Error) {
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn =
  (options: { on401: UnauthorizedBehavior }): QueryFunction<any> =>
  async ({ queryKey }) => {
    const unauthorizedBehavior = options.on401;

    let url = queryKey[0] as string;
    // Prepend base URL for production
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    if (baseUrl && !url.startsWith('http')) {
      url = `${baseUrl}${url}`;
    }

    try {
      // Add Authorization header with token from localStorage (Safari-safe)
      let token: string | null = null;
      try {
        token = localStorage.getItem('authToken');
        // Fallback to sessionStorage for Safari private mode
        if (!token) {
          token = sessionStorage.getItem('authToken');
        }
      } catch (e) {
        // Safari private browsing mode may throw errors
        console.warn('localStorage not available, trying sessionStorage:', e);
        try {
          token = sessionStorage.getItem('authToken');
        } catch (e2) {
          console.warn('sessionStorage also not available:', e2);
        }
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Safari-specific headers
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        headers['Cache-Control'] = 'no-cache';
        headers['Pragma'] = 'no-cache';
      }

      const res = await fetch(url, {
        headers,
        // Removed credentials: 'include' to avoid cookie issues on iPhone
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
