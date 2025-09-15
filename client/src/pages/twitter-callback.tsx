import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const TwitterCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);

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

        // Exchange code for tokens
        const response = await apiRequest('GET', `/api/auth/twitter/callback/?code=${encodeURIComponent(code)}&code_verifier=${encodeURIComponent(codeVerifier)}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to authenticate with Twitter');
        }

        // Store tokens
        localStorage.setItem('authToken', data.tokens.access);
        localStorage.setItem('refreshToken', data.tokens.refresh);
        localStorage.setItem('userId', data.user.id);

        // Clean up
        sessionStorage.removeItem('twitter_code_verifier');

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
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12">
            <svg className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isProcessing ? 'Connecting to Twitter...' : 'Processing...'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isProcessing ? 'Please wait while we authenticate you.' : 'Redirecting...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TwitterCallback;