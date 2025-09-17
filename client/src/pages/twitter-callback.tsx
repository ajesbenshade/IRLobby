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
        const errorDescription = searchParams.get('error_description');

        // Handle OAuth errors from Twitter
        if (error) {
          console.warn('Twitter OAuth error:', error, errorDescription);
          
          // Check if it's a network or external API error
          const isExternalError = error === 'access_denied' || 
            (errorDescription && (
              errorDescription.includes('ERR_ADDRESS_INVALID') ||
              errorDescription.includes('ERR_NETWORK_CHANGED') ||
              errorDescription.includes('ERR_INTERNET_DISCONNECTED') ||
              errorDescription.includes('Failed to fetch')
            ));
          
          if (isExternalError) {
            throw new Error('Twitter is temporarily unavailable. Please try email/password login instead.');
          }
          
          throw new Error(`Twitter authentication failed: ${errorDescription || error}`);
        }

        if (!code) {
          throw new Error('No authorization code received from Twitter');
        }

        // Get the code_verifier from sessionStorage (set during OAuth initiation)
        const codeVerifier = sessionStorage.getItem('twitter_code_verifier');
        if (!codeVerifier) {
          throw new Error('Session expired. Please try logging in again.');
        }

        console.log('Processing Twitter OAuth callback...');

        // Exchange code for tokens
        const response = await apiRequest('GET', `/api/auth/twitter/callback/?code=${encodeURIComponent(code)}&code_verifier=${encodeURIComponent(codeVerifier)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Twitter OAuth callback failed:', response.status, errorData);
          throw new Error(errorData.error || `Authentication failed (${response.status})`);
        }

        const data = await response.json();
        console.log('Twitter OAuth successful');

        // Validate response data
        if (!data.tokens || !data.user) {
          throw new Error('Invalid response from authentication server');
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

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        toast({
          title: 'Authentication Failed',
          description: `Twitter login failed: ${errorMessage}. Please try email/password login instead.`,
          variant: 'destructive',
        });

        // Redirect back to landing page after a delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
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