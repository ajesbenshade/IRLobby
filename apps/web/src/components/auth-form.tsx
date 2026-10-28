import { API_ROUTES } from '@shared/schema';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from '../hooks/use-toast';
import { apiRequest, extractApiErrorMessage } from '../lib/queryClient';

interface AuthFormProps {
  onAuthenticated: (token: string, userId: string) => void;
  loginWithGoogleIdToken?: (idToken: string) => Promise<void>;
  loginWithAppleIdentityToken?: (payload: {
    identityToken: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }) => Promise<void>;
  onOAuthSuccess?: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: () => void;
          renderButton?: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization?: { id_token?: string; code?: string };
          user?: {
            email?: string;
            name?: { firstName?: string; lastName?: string };
          };
        }>;
      };
    };
  }
}

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const APPLE_SCRIPT_SRC =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

const loadScript = (src: string, id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

type AuthResponsePayload = {
  tokens?: {
    access?: string;
    refresh?: string;
  };
  access?: string;
  refresh?: string;
  user?: {
    id?: string | number;
  };
  detail?: string;
  error?: string;
};

const resolveAuthTokens = (data: AuthResponsePayload) => {
  const accessToken =
    typeof data.tokens?.access === 'string'
      ? data.tokens.access
      : typeof data.access === 'string'
      ? data.access
      : null;

  const refreshToken =
    typeof data.tokens?.refresh === 'string'
      ? data.tokens.refresh
      : typeof data.refresh === 'string'
      ? data.refresh
      : null;

  return { accessToken, refreshToken };
};

const AuthForm = ({
  onAuthenticated,
  loginWithGoogleIdToken,
  loginWithAppleIdentityToken,
  onOAuthSuccess,
}: AuthFormProps) => {
  const [activeTab, setActiveTab] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [appleReady, setAppleReady] = useState(false);
  const googleInitialized = useRef(false);
  const appleInitialized = useRef(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
  });

  const googleClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';
  const appleClientId = import.meta.env.VITE_APPLE_WEB_CLIENT_ID?.trim() ?? '';
  const appleRedirectUri =
    import.meta.env.VITE_APPLE_REDIRECT_URI?.trim() ||
    (typeof window !== 'undefined' ? `${window.location.origin}/login` : '');

  const hasOAuth =
    Boolean(loginWithGoogleIdToken && googleClientId) ||
    Boolean(loginWithAppleIdentityToken && appleClientId);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (!googleClientId || !loginWithGoogleIdToken) return;
    let cancelled = false;

    void (async () => {
      try {
        await loadScript(GOOGLE_SCRIPT_SRC, 'google-gis-script');
        if (cancelled || !window.google?.accounts?.id || googleInitialized.current) {
          if (!cancelled) setGoogleReady(true);
          return;
        }
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (!response.credential) {
              toast({
                title: 'Google sign-in failed',
                description: 'No credential returned from Google.',
                variant: 'destructive',
              });
              return;
            }
            try {
              setIsLoading(true);
              await loginWithGoogleIdToken(response.credential);
              toast({ title: 'Success', description: 'Signed in with Google' });
              onOAuthSuccess?.();
            } catch (error) {
              toast({
                title: 'Google sign-in failed',
                description: error instanceof Error ? error.message : 'Please try again.',
                variant: 'destructive',
              });
            } finally {
              setIsLoading(false);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        googleInitialized.current = true;
        if (!cancelled) setGoogleReady(true);
      } catch (error) {
        console.warn('Google Identity Services failed to load:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [googleClientId, loginWithGoogleIdToken, onOAuthSuccess]);

  useEffect(() => {
    if (!appleClientId || !loginWithAppleIdentityToken || !appleRedirectUri) return;
    let cancelled = false;

    void (async () => {
      try {
        await loadScript(APPLE_SCRIPT_SRC, 'apple-auth-script');
        if (cancelled || !window.AppleID?.auth || appleInitialized.current) {
          if (!cancelled) setAppleReady(true);
          return;
        }
        window.AppleID.auth.init({
          clientId: appleClientId,
          scope: 'name email',
          redirectURI: appleRedirectUri,
          usePopup: true,
        });
        appleInitialized.current = true;
        if (!cancelled) setAppleReady(true);
      } catch (error) {
        console.warn('Apple JS SDK failed to load:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appleClientId, appleRedirectUri, loginWithAppleIdentityToken]);

  const handleGoogleSignIn = () => {
    if (!googleReady || !window.google?.accounts?.id) {
      toast({
        title: 'Google sign-in unavailable',
        description: googleClientId
          ? 'Google Sign-In is still loading. Try again in a moment.'
          : 'Set VITE_GOOGLE_WEB_CLIENT_ID for web Google sign-in.',
        variant: 'destructive',
      });
      return;
    }
    window.google.accounts.id.prompt();
  };

  const handleAppleSignIn = async () => {
    if (!appleReady || !window.AppleID?.auth || !loginWithAppleIdentityToken) {
      toast({
        title: 'Apple sign-in unavailable',
        description: appleClientId
          ? 'Apple Sign-In is still loading. Try again in a moment.'
          : 'Set VITE_APPLE_WEB_CLIENT_ID for web Apple sign-in.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await window.AppleID.auth.signIn();
      const identityToken = response.authorization?.id_token;
      if (!identityToken) {
        throw new Error('Apple did not return an identity token.');
      }
      await loginWithAppleIdentityToken({
        identityToken,
        email: response.user?.email ?? null,
        firstName: response.user?.name?.firstName ?? null,
        lastName: response.user?.name?.lastName ?? null,
      });
      toast({ title: 'Success', description: 'Signed in with Apple' });
      onOAuthSuccess?.();
    } catch (error) {
      toast({
        title: 'Apple sign-in failed',
        description: error instanceof Error ? error.message : 'Please try again.',
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
      const response = await apiRequest('POST', API_ROUTES.USER_LOGIN, {
        email: formData.email,
        password: formData.password,
      });

      const data = (await response.json()) as AuthResponsePayload;

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Login failed');
      }

      const { accessToken, refreshToken } = resolveAuthTokens(data);
      const userId = data.user?.id;
      if (!accessToken || userId === undefined || userId === null) {
        throw new Error('Login response missing authentication data');
      }

      // Store the tokens in localStorage (Django JWT format)
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }

      localStorage.setItem('authToken', accessToken);
      localStorage.setItem('userId', String(userId));

      await onAuthenticated(accessToken, String(userId));

      toast({
        title: 'Success',
        description: 'Logged in successfully',
      });
    } catch (error) {
      console.error('Login error:', error);

      // if we detect a 503 we show a friendlier message rather than the raw
      // status text that axios or fetch might produce.
      let description = 'Login failed';
      if (error instanceof Error) {
        if (error.message.includes('503')) {
          description = 'Unable to reach API right now. Please try again.';
        } else {
          description = error.message;
        }
      }

      toast({
        title: 'Error',
        description,
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
      const response = await apiRequest('POST', API_ROUTES.USER_REGISTER, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.passwordConfirm,
        first_name: formData.firstName,
        last_name: formData.lastName,
        ...(formData.dateOfBirth ? { date_of_birth: formData.dateOfBirth } : {}),
      });

      const data = (await response.json()) as AuthResponsePayload;

      if (!response.ok) {
        throw new Error(extractApiErrorMessage(data, 'Registration failed'));
      }

      const { accessToken, refreshToken } = resolveAuthTokens(data);
      const userId = data.user?.id;
      if (!accessToken || userId === undefined || userId === null) {
        throw new Error('Registration response missing authentication data');
      }

      // Store the tokens in localStorage (Django JWT format)
      if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }

      localStorage.setItem('authToken', accessToken);
      localStorage.setItem('userId', String(userId));

      await onAuthenticated(accessToken, String(userId));

      toast({
        title: 'Success',
        description: 'Registered successfully',
      });
    } catch (error) {
      console.error('Registration error:', error);

      let description = 'Registration failed';
      if (error instanceof Error) {
        if (error.message.includes('503')) {
          description = 'Unable to reach API right now. Please try again.';
        } else {
          description = error.message;
        }
      }

      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto border-border/70 bg-card/80 backdrop-blur-xl shadow-float">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Welcome to The Foyer</CardTitle>
        <CardDescription className="text-center">
          Franconia Mennonite Church
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full grid-cols-2 rounded-md bg-muted p-1 text-muted-foreground">
          <button
            type="button"
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === 'login' ? 'bg-background text-foreground shadow-sm' : ''
            }`}
            onClick={() => setActiveTab('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === 'register' ? 'bg-background text-foreground shadow-sm' : ''
            }`}
            onClick={() => setActiveTab('register')}
          >
            Register
          </button>
        </div>

        {activeTab === 'login' ? (
          <>
            <form onSubmit={handleLogin} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
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
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
              <div className="text-sm text-right">
                <Link to="/forgot-password" className="font-medium text-primary hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </>
        ) : (
          <>
            <form onSubmit={handleRegister} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="registerUsername">Username</Label>
                <Input
                  id="registerUsername"
                  name="username"
                  type="text"
                  autoComplete="username"
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
                  autoComplete="given-name"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Birth date</Label>
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="text"
                  placeholder="YYYY-MM-DD"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
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
                  autoComplete="email"
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
                  autoComplete="new-password"
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
                  autoComplete="new-password"
                  required
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Registering...' : 'Register'}
              </Button>
            </form>
          </>
        )}

        {/* OAuth Section: only shown when at least one provider is configured */}
        {hasOAuth ? (
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {loginWithGoogleIdToken && googleClientId ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.3 14.7 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                Continue with Google
              </Button>
            ) : null}
            {loginWithAppleIdentityToken && appleClientId ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => void handleAppleSignIn()}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M16.4 12.7c0-2 1.6-3 1.7-3.1-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.1 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.1-3.1zM14.5 6.5c.6-.7 1-1.7.9-2.7-.9.1-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.3z"
                  />
                </svg>
                Continue with Apple
              </Button>
            ) : null}
          </div>
        </div>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-col items-center space-y-2 text-sm text-muted-foreground">
        <p>The Foyer — Franconia Mennonite Church</p>
        <div className="flex space-x-4">
          <a href="/privacy" className="hover:underline">
            Privacy Policy
          </a>
          <span aria-hidden="true">&bull;</span>
          <a href="/terms" className="hover:underline">
            Terms of Service
          </a>
        </div>
      </CardFooter>
    </Card>
  );
};

export default AuthForm;
