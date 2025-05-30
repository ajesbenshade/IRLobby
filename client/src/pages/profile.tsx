import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Settings, HelpCircle, Star, LogOut, Users } from "lucide-react";
import FriendsModal from "@/components/FriendsModal";

export default function Profile() {
  const { user } = useAuth();
  const [showFriendsModal, setShowFriendsModal] = useState(false);

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="bg-gray-50 pb-20 min-h-screen">
      {/* Header with Profile Info */}
      <header className="bg-white shadow-sm">
        <div className="p-4 text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-white shadow-lg">
            <AvatarImage src={user.profileImageUrl || undefined} />
            <AvatarFallback className="text-xl font-bold bg-primary text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <h2 className="text-xl font-bold text-gray-800">
            {user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`
              : user.email?.split('@')[0] || 'User'
            }
          </h2>
          
          {user.bio && (
            <p className="text-gray-600 mt-1">{user.bio}</p>
          )}
          
          <div className="flex items-center justify-center mt-2">
            <Star className="w-4 h-4 text-yellow-500 mr-1" />
            <span className="text-sm font-medium text-gray-700">
              {user.rating?.toFixed(1) || '5.0'}
            </span>
            <span className="text-sm text-gray-500 ml-2">
              ({user.totalRatings || 0} reviews)
            </span>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Activity Stats */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Activity Stats</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {user.eventsHosted || 0}
                </p>
                <p className="text-xs text-gray-600">Events Hosted</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {user.eventsAttended || 0}
                </p>
                <p className="text-xs text-gray-600">Events Attended</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {(user.eventsHosted || 0) + (user.eventsAttended || 0)}
                </p>
                <p className="text-xs text-gray-600">Total Activities</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interests */}
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {user.interests && user.interests.length > 0 ? (
                user.interests.map((interest, index) => (
                  <Badge key={index} variant="secondary" className="bg-primary/10 text-primary">
                    {interest}
                  </Badge>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No interests added yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setShowFriendsModal(true)}
          >
            <Users className="w-4 h-4 mr-2" />
            Manage Friends
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => {/* TODO: Navigate to edit profile */}}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => {/* TODO: Navigate to settings */}}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => {/* TODO: Navigate to help */}}
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Help & Support
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Friends Modal */}
      <FriendsModal 
        isOpen={showFriendsModal} 
        onClose={() => setShowFriendsModal(false)} 
      />
    </div>
  );
}
