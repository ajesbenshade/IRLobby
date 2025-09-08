import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/card';
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Attempting login with:', formData.email);
      
      const response = await apiRequest('POST', '/api/auth/token/', {
        username: formData.email, // Django expects username, but we'll use email
        password: formData.password,
      });

      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response data:', data);

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      // Store the tokens in localStorage (Django JWT format)
      localStorage.setItem('authToken', data.access);
      localStorage.setItem('refreshToken', data.refresh);
      localStorage.setItem('userId', data.user.id);
      console.log('Auth token stored:', data.access);

      // Call the onAuthenticated callback
      onAuthenticated(data.access, data.user.id);

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
        const errorMessage = data.username?.[0] || data.email?.[0] || data.password?.[0] || data.detail || 'Registration failed';
        throw new Error(errorMessage);
      }

      // Store the tokens in localStorage (Django JWT format)
      localStorage.setItem('authToken', data.tokens.access);
      localStorage.setItem('refreshToken', data.tokens.refresh);
      localStorage.setItem('userId', data.user.id);

      // Call the onAuthenticated callback
      onAuthenticated(data.tokens.access, data.user.id);

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
      <CardHeader>        <CardTitle className="text-2xl text-center">Welcome to IRLobby</CardTitle>
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
      </CardContent>      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        IRlobby - Where activities meet people
      </CardFooter>
    </Card>
  );
};

export default AuthForm;
