import AuthForm from '@/components/auth-form'; // Import the AuthForm component
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth'; // Import the useAuth hook
import { Users, Calendar, MapPin } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const { isAuthenticated, handleAuthentication } = useAuth();
  const navigate = useNavigate();

  // Create a wrapper function to handle authentication
  const handleAuth = async (token: string, userId: string) => {
    await handleAuthentication(token, userId);
  };

  useEffect(() => {
    // Redirect to home if already authenticated
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-green-700 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col justify-center items-center p-6">
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-24 h-24 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-primary dark:text-primary-300 text-2xl font-bold">IRL</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">IRLobby</h1>
        <p className="text-green-100 dark:text-gray-300 text-lg">Your Lobby for IRL Meetups</p>
      </div>

      {/* Authentication form */}
      <div className="w-full max-w-md mb-8">
        <AuthForm onAuthenticated={handleAuth} />
      </div>

      {/* Feature cards */}
      <div className="w-full max-w-md space-y-6 mb-8">
        <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur border-white/20 dark:border-gray-700/50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4 text-white dark:text-gray-100">
              <Users className="w-8 h-8 text-secondary dark:text-secondary-400" />
              <div>
                <h3 className="font-semibold">Meet New People</h3>
                <p className="text-sm text-purple-100 dark:text-gray-300">
                  Connect with like-minded individuals
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur border-white/20 dark:border-gray-700/50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4 text-white dark:text-gray-100">
              <Calendar className="w-8 h-8 text-secondary dark:text-secondary-400" />
              <div>
                <h3 className="font-semibold">Join Activities</h3>
                <p className="text-sm text-purple-100 dark:text-gray-300">
                  From sports to social events
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 dark:bg-gray-800/50 backdrop-blur border-white/20 dark:border-gray-700/50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4 text-white dark:text-gray-100">
              <MapPin className="w-8 h-8 text-secondary dark:text-secondary-400" />
              <div>
                <h3 className="font-semibold">Local Events</h3>
                <p className="text-sm text-purple-100 dark:text-gray-300">
                  Discover activities near you
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-full max-w-md space-y-4">
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-full bg-white dark:bg-gray-700 text-primary dark:text-primary-300 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-lg hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Get Started
        </Button>

        <p className="text-center text-purple-100 dark:text-gray-400 text-sm">
          Join thousands of people discovering amazing activities
        </p>
      </div>
    </div>
  );
}
