import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/use-toast';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { handleAuthentication } = useAuth();

  useEffect(() => {
    const handleCallback = () => {
      // Check for tokens in URL fragment
      const hash = window.location.hash;
      if (hash && hash.includes('tokens=')) {
        try {
          const tokensParam = hash.split('tokens=')[1];
          const tokensData = JSON.parse(decodeURIComponent(tokensParam));

          // Store tokens and user data
          localStorage.setItem('authToken', tokensData.access);
          localStorage.setItem('refreshToken', tokensData.refresh);
          localStorage.setItem('userId', tokensData.user_id);

          // Call the authentication handler
          handleAuthentication(tokensData.access, tokensData.user_id);

          toast({
            title: 'Success',
            description: 'Successfully logged in with X (Twitter)',
          });

          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);

          // Redirect to home page
          navigate('/');
          return;
        } catch (error) {
          console.error('Error parsing tokens:', error);
        }
      }

      // Check for error in query params
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        toast({
          title: 'Authentication Failed',
          description: `Failed to authenticate: ${error}`,
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      // If no tokens or error, redirect to home
      navigate('/');
    };

    handleCallback();
  }, [navigate, handleAuthentication]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Completing Authentication</h2>
        <p className="text-muted-foreground">Please wait while we log you in...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;