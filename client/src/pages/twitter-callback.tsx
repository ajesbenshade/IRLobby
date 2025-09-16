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

        // Exchange code for tokens (which are now set as httpOnly cookies)
        const response = await apiRequest('GET', `/api/auth/twitter/callback/?code=${encodeURIComponent(code)}&code_verifier=${encodeURIComponent(codeVerifier)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to authenticate with Twitter');
        }

        // Clean up
        sessionStorage.removeItem('twitter_code_verifier');

        // Trigger a refresh of the authentication state
        await handleAuthentication();

        // Verify authentication by making a direct API call
        try {
          const authCheckResponse = await apiRequest('GET', '/api/users/auth/status/');
          const authData = await authCheckResponse.json();

          if (authData.isAuthenticated) {
            toast({
              title: 'Success',
              description: 'Successfully logged in with Twitter!',
            });

            // Redirect to home
            navigate('/', { replace: true });
          } else {
            throw new Error('Authentication verification failed');
          }
        } catch (authError) {
          console.error('Auth verification failed:', authError);
          throw new Error('Failed to verify authentication');
        }
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