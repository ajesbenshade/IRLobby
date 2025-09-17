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
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/users/profile"],
    enabled: !!token,
    retry: (failureCount, error) => {
      // Don't retry on 401 (unauthorized) - token is invalid
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      // Retry once for other errors
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch when reconnecting
    queryFn: async () => {
      if (!token) return null;
      
      try {
        const response = await apiRequest('GET', '/api/users/profile/');
        
        if (response.status === 401) {
          // Token is invalid, clear it
          console.warn('Invalid token detected, clearing authentication');
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userId');
          setToken(null);
          return null;
        }

        if (!response.ok) {
          throw new Error(`Profile request failed: ${response.status}`);
        }
        
        return response.json();
      } catch (error) {
        // Only log non-401 errors as warnings
        if (!(error instanceof Error && error.message.includes('401'))) {
          console.warn('Profile fetch failed:', error);
        }
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
      // Clear tokens first
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      setToken(null);
      
      // Clear all queries and force a complete reset
      queryClient.clear();
      
      // Invalidate the user profile query specifically
      await queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
      
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
