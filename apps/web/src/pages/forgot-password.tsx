import { API_ROUTES } from '@shared/schema';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from '../hooks/use-toast';
import { apiRequest } from '../lib/queryClient';
import { extractResetToken } from '../lib/resetToken';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const navigate = useNavigate();

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractResetToken(tokenInput);
    if (!token) return;
    navigate(`/reset-password/${encodeURIComponent(token)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await apiRequest('POST', API_ROUTES.AUTH_REQUEST_PASSWORD_RESET, { email });

      const responseText = await response.text();
      let data: { message?: string; detail?: string } | null = null;

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.warn('Forgot password response was not valid JSON:', parseError);
          data = { message: responseText };
        }
      }

      if (!response.ok) {
        const errorMessage = data?.message || data?.detail || 'Failed to request password reset';
        throw new Error(errorMessage);
      }

      const successMessage =
        data?.message ||
        data?.detail ||
        'If an account with that email exists, a password reset link has been sent.';

      setMessage(successMessage);
      toast({
        title: 'Success',
        description: successMessage,
      });
    } catch (error) {
      console.error('Forgot password error:', error);

      const fallbackMessage =
        'If an account with that email exists, a password reset link has been sent.';
      let errorMessage = fallbackMessage;

      if (error instanceof Error) {
        if (error.message.includes("Failed to execute 'json' on 'Response'")) {
          console.warn('Password reset request failed due to empty or invalid JSON response.');
        } else {
          errorMessage = error.message;
        }
      }

      setMessage(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Forgot Password</CardTitle>
          <CardDescription className="text-center">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="your@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
          {message && (
            <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-400">{message}</p>
          )}
          <form onSubmit={handleTokenSubmit} className="mt-6 space-y-3 border-t pt-4">
            <p className="text-sm font-medium">I have a code</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Paste the code from your reset email to choose a new password.
            </p>
            <Label htmlFor="token">Reset code</Label>
            <Input
              id="token"
              name="token"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Paste your reset code"
              required
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <Button type="submit" variant="outline" className="w-full">
              Continue
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
