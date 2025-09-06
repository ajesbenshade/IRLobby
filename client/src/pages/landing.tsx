import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Users, Calendar, MapPin } from "lucide-react";
import AuthForm from "@/components/auth-form"; // Import the AuthForm component
import { useAuth } from "@/hooks/useAuth"; // Import the useAuth hook
import { useEffect } from "react";

export default function Landing() {
  const { isAuthenticated, handleAuthentication } = useAuth();

  useEffect(() => {
    // Redirect to home if already authenticated
    if (isAuthenticated) {
      window.location.href = '/home';
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-purple-700 flex flex-col justify-center items-center p-6">
      <div className="text-center mb-8 animate-fade-in">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Heart className="text-primary text-3xl" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">IRLobby</h1>
        <p className="text-purple-100 text-lg">Your Lobby for IRL Meetups</p>
      </div>

      {/* Authentication form */}
      <div className="w-full max-w-md mb-8">
        <AuthForm onAuthenticated={handleAuthentication} />
      </div>

      {/* Feature cards */}
      <div className="w-full max-w-md space-y-6 mb-8">
        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4 text-white">
              <Users className="w-8 h-8 text-secondary" />
              <div>
                <h3 className="font-semibold">Meet New People</h3>
                <p className="text-sm text-purple-100">Connect with like-minded individuals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4 text-white">
              <Calendar className="w-8 h-8 text-secondary" />
              <div>
                <h3 className="font-semibold">Join Activities</h3>
                <p className="text-sm text-purple-100">From sports to social events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur border-white/20">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4 text-white">
              <MapPin className="w-8 h-8 text-secondary" />
              <div>
                <h3 className="font-semibold">Local Events</h3>
                <p className="text-sm text-purple-100">Discover activities near you</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-full max-w-md space-y-4">
        <Button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-full bg-white text-primary py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all text-lg"
        >
          Get Started
        </Button>
        
        <p className="text-center text-purple-100 text-sm">
          Join thousands of people discovering amazing activities
        </p>
      </div>
    </div>
  );
}
