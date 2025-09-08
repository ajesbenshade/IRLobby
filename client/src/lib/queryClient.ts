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

  const token = localStorage.getItem('authToken');
  const headers: Record<string, string> = {};

  if (data !== undefined && data !== null) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers['Authorization'] = `Bearer ${token}`;

  console.log(`Making ${method} request to ${url} with token: ${token ? 'Yes' : 'No'}`);

  const res = await fetch(url, {
    method,
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn =
  (options: { on401: UnauthorizedBehavior }): QueryFunction<any> =>
  async ({ queryKey }) => {
    const unauthorizedBehavior = options.on401;
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {};

    if (token) headers['Authorization'] = `Bearer ${token}`;

    console.log(`Query request to ${queryKey[0]} with token: ${token ? 'Yes' : 'No'}`);

    const res = await fetch(queryKey[0] as string, {
      headers,
      credentials: 'include',
    });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) return null;

    await throwIfResNotOk(res);
    return await res.json();
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
