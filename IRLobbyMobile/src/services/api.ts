import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - Update this with your Render backend URL
const API_BASE_URL = 'https://irlobby-backend.onrender.com';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(...args: any[]): Promise<Response> {
  const httpMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

  let method = 'GET';
  let url: string;
  let data: any = undefined;

  if (typeof args[0] === 'string' && typeof args[1] === 'string' && httpMethods.has((args[0] as string).toUpperCase())) {
    method = (args[0] as string).toUpperCase();
    url = args[1] as string;
    data = args[2];
  } else if (typeof args[0] === 'string') {
    url = args[0] as string;
    const opts = args[1] || {};
    method = (opts.method || 'GET').toUpperCase();
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

  // Prepend base URL
  if (!url.startsWith('http')) {
    url = `${API_BASE_URL}${url}`;
  }

  const token = await AsyncStorage.getItem('authToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

// Auth API functions
export const authAPI = {
  login: (email: string, password: string) =>
    apiRequest('POST', '/api/auth/token/', { email, password }),

  register: (userData: any) =>
    apiRequest('POST', '/api/users/register/', userData),

  refreshToken: (refreshToken: string) =>
    apiRequest('POST', '/api/auth/token/refresh/', { refresh: refreshToken }),
};

// Activities API functions
export const activitiesAPI = {
  getActivities: () =>
    apiRequest('/api/activities/'),

  createActivity: (activityData: any) =>
    apiRequest('POST', '/api/activities/', activityData),

  joinActivity: (activityId: number) =>
    apiRequest('POST', `/api/activities/${activityId}/join/`),
};

// Users API functions
export const usersAPI = {
  getProfile: () =>
    apiRequest('/api/users/profile/'),

  updateProfile: (profileData: any) =>
    apiRequest('PUT', '/api/users/profile/', profileData),
};
