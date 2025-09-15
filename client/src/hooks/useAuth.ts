import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from 'react';
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
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  
  // Fetch user data if token exists
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/users/profile"],
    enabled: !!token,
    retry: false,
    queryFn: async () => {
      if (!token) return null;
      
      try {
        const response = await apiRequest('GET', '/api/users/profile/');
        return response.json();
      } catch (error) {
        console.warn('Backend not available, running in frontend-only mode:', error);
        return null;
      }
    }
  });

  // Handle authentication (login/register)
  const handleAuthentication = useCallback(async (newToken: string, userId: string) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('userId', userId);
    setToken(newToken);
    // Invalidate and refetch the user profile query
    await queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
    // Force a refetch to ensure the user data is loaded
    await queryClient.refetchQueries({ queryKey: ["/api/users/profile"] });
  }, [queryClient]);

  // Handle logout
  const logout = useCallback(async () => {
    try {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      setToken(null);
      queryClient.clear();
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
      setToken(data.access);
      return data.access;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return null;
    }
  }, [logout]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    token,
    handleAuthentication,
    logout,
    refreshToken,
  };
}
