import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Settings, HelpCircle, Star, LogOut, Users } from "lucide-react";
import FriendsModal from "@/components/FriendsModal";
import EditProfileModal from "@/components/EditProfileModal";

export default function Profile({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const { user, logout, isLoading } = useAuth();
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      // Force navigation to landing page after logout
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
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
    <div className="bg-gray-50 dark:bg-gray-900 pb-4 min-h-screen pt-safe">
      {/* Header with Profile Info */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="p-4 text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4 border-4 border-white dark:border-gray-700 shadow-lg">
            <AvatarImage src={user.profileImageUrl || undefined} />
            <AvatarFallback className="text-xl font-bold bg-primary text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}`
              : user.email?.split('@')[0] || 'User'
            }
          </h2>
          
          {user.bio && (
            <p className="text-gray-600 dark:text-gray-300 mt-1">{user.bio}</p>
          )}
          
          <div className="flex items-center justify-center mt-2">
            <Star className="w-4 h-4 text-yellow-500 mr-1" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {user.rating?.toFixed(1) || '5.0'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              ({user.totalRatings || 0} reviews)
            </span>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Activity Stats */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Activity Stats</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {user.eventsHosted || 0}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Events Hosted</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {user.eventsAttended || 0}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Events Attended</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {(user.eventsHosted || 0) + (user.eventsAttended || 0)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Activities</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interests */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {user.interests && user.interests.length > 0 ? (
                user.interests.map((interest: string, index: number) => (
                  <Badge key={index} variant="secondary" className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-300">
                    {interest}
                  </Badge>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No interests added yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setShowEditModal(true)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => setShowFriendsModal(true)}
          >
            <Users className="w-4 h-4 mr-2" />
            Friends
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => onNavigate && onNavigate('settings')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>

          <Button 
            variant="outline" 
            className="w-full justify-start"
            onClick={() => onNavigate && onNavigate('help-support')}
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

      {/* Modals */}
      <FriendsModal 
        isOpen={showFriendsModal} 
        onClose={() => setShowFriendsModal(false)} 
      />
      
      <EditProfileModal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)}
        user={user}
      />
    </div>
  );
}
