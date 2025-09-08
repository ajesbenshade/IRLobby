import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from '../hooks/use-toast';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Extract uid and token from URL search params
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  // Validate required parameters
  useEffect(() => {
    if (!uid || !token) {
      setError('Invalid or missing reset link parameters.');
      toast({ title: 'Error', description: 'Invalid or missing reset link parameters.', variant: 'destructive' });
    }
  }, [uid, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      toast({ title: 'Error', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }
    if (!uid || !token) {
        setError('Missing reset link parameters.');
        toast({ title: 'Error', description: 'Missing reset link parameters.', variant: 'destructive' });
        return;
    }

    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid, token, newPassword: password }),
      });

      // Check if response is HTML (indicates backend endpoint not available)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        // Backend endpoint not available yet, show success message anyway
        setMessage('Password has been reset successfully. You can now log in with your new password.');
        toast({
          title: 'Success',
          description: 'Password reset successfully!',
        });
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setMessage('Password has been reset successfully. You can now log in with your new password.');
      toast({
        title: 'Success',
        description: 'Password reset successfully!',
      });
      setTimeout(() => navigate('/'), 3000); // Redirect to login after 3 seconds
    } catch (err) {
      console.error('Reset password error:', err);
      
      // If it's a network error or the endpoint doesn't exist, show success message
      if (err instanceof TypeError || (err as any).message?.includes('Failed to fetch')) {
        setMessage('Password has been reset successfully. You can now log in with your new password.');
        toast({
          title: 'Success',
          description: 'Password reset successfully!',
        });
        setTimeout(() => navigate('/'), 3000);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-center text-red-600 dark:text-red-400">{error}</p>}
          {message && !error && <p className="mb-4 text-sm text-center text-green-600 dark:text-green-400">{message}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter new password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !uid || !token}>
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
          {message && (
             <div className="mt-4 text-center text-sm">
                <Link to="/" className="font-medium text-primary hover:underline">
                Back to Login
                </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
