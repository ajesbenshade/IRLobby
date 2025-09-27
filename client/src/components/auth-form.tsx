import { useState } from 'react';

import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from '../hooks/use-toast';
import { apiRequest } from '../lib/queryClient';

interface AuthFormProps {
  onAuthenticated: (token: string, userId: string) => void;
}

const AuthForm = ({ onAuthenticated }: AuthFormProps) => {
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    firstName: '',
    lastName: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTwitterOAuth = async () => {
    try {
      setIsLoading(true);
      console.log('Starting Twitter OAuth...');

      const response = await apiRequest('GET', '/api/auth/twitter/url/');
      console.log('OAuth URL response:', response.status, response);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OAuth URL error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('OAuth URL data:', data);

      const authUrl = data.auth_url;
      const stateToken = data.state ?? null;

      if (!authUrl) {
        console.error('Invalid OAuth response:', data);
        throw new Error('Invalid OAuth response from server');
      }

      if (stateToken) {
        sessionStorage.setItem('twitter_oauth_state', stateToken);
      } else {
        sessionStorage.removeItem('twitter_oauth_state');
      }

      console.log('Redirecting to Twitter OAuth URL...');
      window.location.href = authUrl;
    } catch (error) {
      console.error('Twitter OAuth error:', error);

      // Check if it's a configuration error
      const isConfigError =
        error instanceof Error &&
        (error.message.includes('not configured') ||
          error.message.includes('500') ||
          error.message.includes('503') ||
          error.message.includes('Twitter OAuth'));

      const isNetworkError =
        error instanceof Error &&
        (error.message.includes('Failed to connect') ||
          error.message.includes('502') ||
          error.message.includes('timeout'));

      let errorTitle = 'Twitter OAuth Failed';
      let errorDescription =
        'Unable to connect to Twitter. Please try email/password login instead.';

      if (isConfigError) {
        errorTitle = 'Twitter OAuth Unavailable';
        errorDescription =
          'Twitter login is temporarily unavailable. Please use email/password login.';
      } else if (isNetworkError) {
        errorTitle = 'Connection Error';
        errorDescription =
          'Unable to connect to Twitter. Please check your internet connection and try again.';
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Attempting login with:', formData.email);

      const response = await apiRequest('POST', '/api/users/login/', {
        email: formData.email,
        password: formData.password,
      });

      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response data:', data);
      console.log('Data structure:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      // Store the tokens in localStorage (Django JWT format)
      if (
        typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        data.tokens.refresh
      ) {
        localStorage.setItem('refreshToken', data.tokens.refresh);
      }

      localStorage.setItem('authToken', data.tokens.access);
      localStorage.setItem('userId', data.user.id);
      console.log('Login successful, token stored:', data.tokens.access);

      // Small delay to ensure token is stored before making authenticated requests
      setTimeout(async () => {
        // Call the onAuthenticated callback
        await onAuthenticated(data.tokens.access, data.user.id);
      }, 100);

      toast({
        title: 'Success',
        description: 'Logged in successfully',
      });
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Login failed',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest('POST', '/api/users/register/', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.passwordConfirm,
        first_name: formData.firstName,
        last_name: formData.lastName,
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle Django's error format
        const errorMessage =
          data.username?.[0] ||
          data.email?.[0] ||
          data.password?.[0] ||
          data.detail ||
          'Registration failed';
        throw new Error(errorMessage);
      }

      // Store the tokens in localStorage (Django JWT format)
      if (
        typeof window !== 'undefined' &&
        window.location.protocol !== 'https:' &&
        data.tokens.refresh
      ) {
        localStorage.setItem('refreshToken', data.tokens.refresh);
      }

      localStorage.setItem('authToken', data.tokens.access);
      localStorage.setItem('userId', data.user.id);
      console.log('Registration successful, token stored:', data.tokens.access);

      // Small delay to ensure token is stored before making authenticated requests
      setTimeout(async () => {
        // Call the onAuthenticated callback
        await onAuthenticated(data.tokens.access, data.user.id);
      }, 100);

      toast({
        title: 'Success',
        description: 'Registered successfully',
      });
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Registration failed',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Welcome to IRLobby</CardTitle>
        <CardDescription className="text-center">
          Your Lobby for IRL Meetups - Connect, Discover, Experience
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              <div className="text-sm text-right">
                <a href="/forgot-password" className="font-medium text-primary hover:underline">
                  Forgot Password?
                </a>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="registerUsername">Username</Label>
                <Input
                  id="registerUsername"
                  name="username"
                  type="text"
                  placeholder="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registerEmail">Email</Label>
                <Input
                  id="registerEmail"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registerPassword">Password</Label>
                <Input
                  id="registerPassword"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">Confirm Password</Label>
                <Input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  required
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Registering...' : 'Register'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {/* OAuth Section */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleTwitterOAuth}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                  fill="currentColor"
                />
              </svg>
              {isLoading ? 'Connecting...' : 'Continue with X (Twitter)'}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-2 text-sm text-muted-foreground">
        <p>IRLobby - Where activities meet people</p>
        <div className="flex space-x-4">
          <a href="/privacy-policy" className="hover:underline">
            Privacy Policy
          </a>
          <span aria-hidden="true">&bull;</span>
          <a href="/terms-of-service" className="hover:underline">
            Terms of Service
          </a>
        </div>
      </CardFooter>
    </Card>
  );
};

export default AuthForm;
