import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const TwitterCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const { handleAuthentication } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we have tokens in URL (new flow)
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const userId = searchParams.get('user_id');

        if (accessToken && refreshToken) {
          // New flow: Backend redirected with tokens in URL
          console.log('Received tokens from URL, setting cookies...');

          // Set cookies on frontend domain
          document.cookie = `access_token=${accessToken}; path=/; max-age=3600; secure; samesite=Lax`;
          document.cookie = `refresh_token=${refreshToken}; path=/; max-age=604800; secure; samesite=Lax`;

          // Clean up URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);

          // Trigger authentication refresh
          await handleAuthentication();

          toast({
            title: 'Success',
            description: 'Successfully logged in with Twitter!',
          });

          navigate('/', { replace: true });
          return;
        }

        // Fallback to old flow with code exchange
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Get the code_verifier from sessionStorage (set during OAuth initiation)
        const codeVerifier = sessionStorage.getItem('twitter_code_verifier');
        if (!codeVerifier) {
          throw new Error('Code verifier not found. Please try logging in again.');
        }

        // Exchange code for tokens
        const response = await apiRequest('GET', `/api/auth/twitter/callback/?code=${encodeURIComponent(code)}&code_verifier=${encodeURIComponent(codeVerifier)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to authenticate with Twitter');
        }

        // Clean up
        sessionStorage.removeItem('twitter_code_verifier');

        // Trigger a refresh of the authentication state
        await handleAuthentication();

        toast({
          title: 'Success',
          description: 'Successfully logged in with Twitter!',
        });

        // Redirect to home
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Twitter OAuth callback error:', error);

        // Clean up on error
        sessionStorage.removeItem('twitter_code_verifier');

        toast({
          title: 'Authentication Failed',
          description: error instanceof Error ? error.message : 'Failed to authenticate with Twitter',
          variant: 'destructive',
        });

        // Redirect back to landing page
        navigate('/', { replace: true });
      } finally {
        setIsProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast, handleAuthentication]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Authenticating with Twitter...</h1>
        {isProcessing && <p>Please wait while we securely log you in.</p>}
      </div>
    </div>
  );
};

export default TwitterCallback;