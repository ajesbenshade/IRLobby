import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  User, 
  MapPin, 
  Star, 
  Calendar, 
  Users, 
  Settings, 
  LogOut,
  UserPlus,
  Edit,
  Briefcase,
  Globe,
  Shield,
  Clock,
  Heart,
  MessageCircle,
  Instagram,
  Twitter,
  Linkedin,
  Award,
  Target
} from "lucide-react";
import FriendsModal from "@/components/FriendsModal";
import ProfileEditModal from "@/components/ProfileEditModal";

export default function EnhancedProfile() {
  const { user, isLoading } = useAuth();
  const [showFriends, setShowFriends] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center space-y-4 pt-6">
            <User className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Please log in to view your profile</p>
            <Button onClick={() => window.location.href = '/api/login'}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profileCompleteness = user.profileCompleteness || 20;
  const fullName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.firstName || user.lastName || user.email;

  const getVerificationIcon = () => {
    if (user.verificationLevel === 'id') return <Shield className="h-4 w-4 text-green-600" />;
    if (user.verificationLevel === 'phone') return <Shield className="h-4 w-4 text-blue-600" />;
    if (user.verificationLevel === 'email') return <Shield className="h-4 w-4 text-yellow-600" />;
    return null;
  };

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return <Instagram className="h-4 w-4" />;
      case 'twitter': return <Twitter className="h-4 w-4" />;
      case 'linkedin': return <Linkedin className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        
        {/* Header Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-32"></div>
          <CardContent className="relative pt-0 pb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4 -mt-16">
                <Avatar className="h-32 w-32 border-4 border-white">
                  <AvatarImage src={user.profileImageUrl} alt={fullName} />
                  <AvatarFallback className="text-2xl">
                    {fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="mt-16 space-y-2">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">{fullName}</h1>
                    {getVerificationIcon()}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    {user.age && (
                      <span>{user.age} years old</span>
                    )}
                    {user.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {user.location}
                      </div>
                    )}
                    {user.occupation && (
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        {user.occupation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowEditProfile(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
                <Button variant="outline" onClick={() => setShowFriends(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Manage Friends
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/api/logout'}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Out
                </Button>
              </div>
            </div>

            {/* Profile Completeness */}
            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Profile Completeness</span>
                <span className="text-sm text-gray-600">{profileCompleteness}%</span>
              </div>
              <Progress value={profileCompleteness} className="h-2" />
              {profileCompleteness < 80 && (
                <p className="text-xs text-gray-500 mt-1">
                  Complete your profile to increase your chances of being accepted to events
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column */}
          <div className="space-y-6">
            
            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent>
                {user.bio ? (
                  <p className="text-gray-700">{user.bio}</p>
                ) : (
                  <p className="text-gray-500 italic">No bio added yet</p>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Rating</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{user.rating?.toFixed(1) || '5.0'}</div>
                    <div className="text-xs text-gray-500">
                      {user.totalRatings || 0} reviews
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold">{user.eventsHosted || 0}</div>
                    <div className="text-xs text-gray-500">Events Hosted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold">{user.eventsAttended || 0}</div>
                    <div className="text-xs text-gray-500">Events Attended</div>
                  </div>
                </div>

                {user.reliability && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Reliability</span>
                      </div>
                      <div className="font-semibold">{user.reliability.toFixed(1)}/5.0</div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Social Links */}
            {user.socialLinks && Object.keys(user.socialLinks).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Social Links
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(user.socialLinks).map(([platform, username]) => (
                      username && (
                        <div key={platform} className="flex items-center gap-2">
                          {getSocialIcon(platform)}
                          <span className="text-sm capitalize">{platform}</span>
                          <span className="text-sm text-gray-600">{username}</span>
                        </div>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Experience & Skills */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Experience & Skills
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {user.experienceLevel && (
                  <div>
                    <Label className="text-sm font-medium">Experience Level</Label>
                    <Badge variant="secondary" className="ml-2">{user.experienceLevel}</Badge>
                  </div>
                )}

                {user.languages && user.languages.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Languages</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.languages.map((language: string) => (
                        <Badge key={language} variant="outline" className="text-xs">
                          {language}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Interests */}
            {user.interests && user.interests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Interests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {user.interests.map((interest: string) => (
                      <Badge key={interest} variant="secondary">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Activity Preferences */}
            {user.activityPreferences && user.activityPreferences.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Activity Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {user.activityPreferences.map((preference: string) => (
                      <Badge key={preference} variant="outline" className="justify-center">
                        {preference}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Personality Traits */}
            {user.personalityTraits && user.personalityTraits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Personality Traits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {user.personalityTraits.map((trait: string) => (
                      <Badge key={trait} variant="outline" className="bg-blue-50 text-blue-700">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <FriendsModal 
        isOpen={showFriends} 
        onClose={() => setShowFriends(false)} 
      />
      
      <ProfileEditModal 
        isOpen={showEditProfile} 
        onClose={() => setShowEditProfile(false)}
        currentUser={user}
      />
    </div>
  );
}