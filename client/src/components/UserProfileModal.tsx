import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { Star, MapPin, Calendar, Users, Award } from 'lucide-react';
import { useState } from 'react';

import UserReviewsModal from './UserReviewsModal';

interface UserProfile {
  profileImageUrl?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  location?: string;
  rating?: number;
  totalRatings?: number;
  eventsHosted?: number;
  eventsAttended?: number;
  bio?: string;
  interests?: string[];
  photoAlbum?: string[];
  isVerified?: boolean;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSendFriendRequest?: () => void;
  showActions?: boolean;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  userId,
  onSendFriendRequest,
  showActions = true,
}: UserProfileModalProps) {
  const [showReviews, setShowReviews] = useState(false);

  // Fetch user profile data
  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: [`/api/users/${userId}`],
    enabled: isOpen && !!userId,
  });

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg mx-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading profile...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!user) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg mx-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">User not found</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user.profileImageUrl} />
              <AvatarFallback className="text-lg">
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-muted-foreground">{user.email}</p>
              {user.location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-4 w-4" />
                  {user.location}
                </div>
              )}
            </div>
          </div>

          {/* Rating & Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setShowReviews(true)}
            >
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold">{user.rating?.toFixed(1) || 'N/A'}</span>
                </div>
                <div className="text-xs text-muted-foreground hover:text-primary">
                  {user.totalRatings || 0} reviews
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="font-bold">{user.eventsHosted || 0}</span>
                </div>
                <div className="text-xs text-muted-foreground">Events Hosted</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="h-4 w-4" />
                  <span className="font-bold">{user.eventsAttended || 0}</span>
                </div>
                <div className="text-xs text-muted-foreground">Events Attended</div>
              </CardContent>
            </Card>
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="space-y-2">
              <h3 className="font-semibold">About</h3>
              <p className="text-muted-foreground">{user.bio}</p>
            </div>
          )}

          {/* Interests */}
          {user.interests && user.interests.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {user.interests.map((interest: string, index: number) => (
                  <Badge key={index} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Photo Album */}
          {user.photoAlbum && user.photoAlbum.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold">Photos</h3>
              <div className="grid grid-cols-3 gap-2">
                {user.photoAlbum.slice(0, 6).map((photo: string, index: number) => (
                  <div key={index} className="aspect-square">
                    <img
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border"
                    />
                  </div>
                ))}
              </div>
              {user.photoAlbum.length > 6 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{user.photoAlbum.length - 6} more photos
                </p>
              )}
            </div>
          )}

          {/* Verification Status */}
          {user.isVerified && (
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-blue-500">Verified User</span>
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Close
              </Button>
              {onSendFriendRequest && (
                <Button onClick={onSendFriendRequest} className="flex-1">
                  Add Friend
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      <UserReviewsModal
        isOpen={showReviews}
        onClose={() => setShowReviews(false)}
        userId={userId}
        userName={user ? `${user.firstName} ${user.lastName}` : ''}
      />
    </Dialog>
  );
}
