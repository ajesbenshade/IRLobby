import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from 'react';
import { apiRequest } from '../lib/queryClient';

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  bio?: string;
  [key: string]: any;
}

export function useAuth() {
  const queryClient = useQueryClient();

  // Check authentication status via API call (since tokens are in httpOnly cookies)
  const { data: authData, isLoading } = useQuery({
    queryKey: ["/api/users/auth/status"],
    retry: false,
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/users/auth/status/');
        return response.json();
      } catch (error) {
        console.warn('Authentication check failed:', error);
        return { isAuthenticated: false, user: null };
      }
    }
  });

  const user = authData?.user || null;
  const isAuthenticated = authData?.isAuthenticated || false;

  // Handle authentication (login/register) - now just triggers a refetch
  const handleAuthentication = useCallback(async () => {
    // Invalidate and refetch the auth status query
    await queryClient.invalidateQueries({ queryKey: ["/api/users/auth/status"] });
    await queryClient.refetchQueries({ queryKey: ["/api/users/auth/status"] });
  }, [queryClient]);

  // Handle logout
  const logout = useCallback(async () => {
    try {
      // Call logout API to clear cookies
      await apiRequest('POST', '/api/users/logout/');

      // Clear localStorage tokens
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');

      // Clear sessionStorage tokens (Safari fallback)
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('userId');

      // Clear all queries and force a complete reset
      queryClient.clear();

      // Invalidate the auth status query
      await queryClient.invalidateQueries({ queryKey: ["/api/users/auth/status"] });

      // Small delay to ensure state updates propagate
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [queryClient]);

  // Handle token refresh
  const refreshToken = useCallback(async () => {
    const refresh = localStorage.getItem('refreshToken');
    if (!refresh) {
      logout();
      return null;
    }

    try {
      const response = await apiRequest('POST', '/api/users/token/refresh/', {
        refresh: refresh
      });
      const data = await response.json();
      
      localStorage.setItem('authToken', data.access);
      return data.access;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return null;
    }
  }, [logout]);

  return {
    user,
    isAuthenticated,
    isLoading,
    handleAuthentication,
    logout,
    refreshToken,
  };
}
