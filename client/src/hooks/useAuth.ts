import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from 'react';

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
      
      const response = await fetch('/api/users/profile/', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      return response.json();
    }
  });

  // Handle authentication (login/register)
  const handleAuthentication = useCallback((newToken: string, userId: string) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('userId', userId);
    setToken(newToken);
    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  }, [queryClient]);

  // Handle logout
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout/', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      setToken(null);
      queryClient.setQueryData(["/api/users/profile"], null);
    }
  }, [queryClient]);

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    handleAuthentication,
    logout,
  };
}
