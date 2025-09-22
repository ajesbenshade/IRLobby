import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

import { toast } from '../hooks/use-toast';
import { apiRequest } from '../lib/queryClient';

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  bio?: string;
  interests?: string[];
  photoAlbum?: string[];
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [authError, setAuthError] = useState<string | null>(null);

  const setAuthErrorMessage = useCallback((message: string | null) => {
    setAuthError((prev) => (prev === message ? prev : message));
  }, []);

  const clearStoredCredentials = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
  }, []);

  useEffect(() => {
    if (authError) {
      toast({
        title: 'Authentication issue',
        description: authError,
        variant: 'destructive',
      });
    }
  }, [authError]);

  const {
    data: user,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<User | null, Error>({
    queryKey: ['/api/users/profile'],
    enabled: !!token,
    retry: (failureCount, queryError) => {
      if (queryError instanceof Error && /401|403/.test(queryError.message)) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!token) {
        setAuthErrorMessage(null);
        return null;
      }

      try {
        const response = await apiRequest('GET', '/api/users/profile/');

        if (response.status === 401) {
          console.warn('Invalid token detected, clearing authentication');
          clearStoredCredentials();
          setToken(null);
          queryClient.setQueryData(['/api/users/profile'], null);
          setAuthErrorMessage('Your session has expired. Please sign in again.');
          return null;
        }

        if (!response.ok) {
          throw new Error(`Profile request failed: ${response.status}`);
        }

        const profile = await response.json();
        setAuthErrorMessage(null);
        return profile;
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.message.includes('401')) {
          setAuthErrorMessage('Your session has expired. Please sign in again.');
          clearStoredCredentials();
          setToken(null);
          queryClient.setQueryData(['/api/users/profile'], null);
          return null;
        }

        console.warn('Profile fetch failed:', fetchError);
        setAuthErrorMessage('We could not load your profile. Please try again.');
        throw fetchError;
      }
    },
  });

  const retryProfile = useCallback(async () => {
    const result = await refetch({ throwOnError: false });
    if (!result.error) {
      setAuthErrorMessage(null);
    }
    return result;
  }, [refetch, setAuthErrorMessage]);

  const handleAuthentication = useCallback(
    async (newToken: string, userId: string) => {
      localStorage.setItem('authToken', newToken);
      localStorage.setItem('userId', userId);
      setToken(newToken);
      setAuthErrorMessage(null);
      await queryClient.invalidateQueries({ queryKey: ['/api/users/profile'] });
      await queryClient.refetchQueries({ queryKey: ['/api/users/profile'] });
    },
    [queryClient, setAuthErrorMessage],
  );

  const logout = useCallback(async () => {
    try {
      clearStoredCredentials();
      setToken(null);
      setAuthErrorMessage(null);

      await queryClient.cancelQueries({ type: 'all' });
      queryClient.removeQueries();
    } catch (logoutError) {
      console.error('Logout error:', logoutError);
    }
  }, [clearStoredCredentials, queryClient, setAuthErrorMessage]);

  const refreshToken = useCallback(async () => {
    const refresh = localStorage.getItem('refreshToken');
    if (!refresh) {
      await logout();
      return null;
    }

    try {
      const response = await apiRequest('POST', '/api/users/token/refresh/', {
        refresh: refresh,
      });
      const data = await response.json();

      localStorage.setItem('authToken', data.access);
      setToken(data.access);
      setAuthErrorMessage(null);
      return data.access;
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      setAuthErrorMessage('Your session has expired. Please sign in again.');
      await logout();
      return null;
    }
  }, [logout, setAuthErrorMessage]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading: isLoading || isFetching,
    token,
    handleAuthentication,
    logout,
    refreshToken,
    authError,
    retryProfile,
    profileError: error,
  };
}
