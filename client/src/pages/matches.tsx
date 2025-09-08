import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface MatchesProps {
  onOpenChat: (activityId: number) => void;
  showUserActivities?: boolean;
}

export default function Matches({ onOpenChat, showUserActivities = false }: MatchesProps) {
  const { user } = useAuth();

  // Use different endpoints based on whether we're showing user activities or matches
  const { data: activities = [], isLoading } = useQuery<any[]>({
    queryKey: showUserActivities ? ['/api/activities/hosted'] : ['/api/matches'],
    retry: 1,
  });

  // Also fetch attended activities if showing user activities
  const { data: attendedActivities = [] } = useQuery<any[]>({
    queryKey: showUserActivities && user ? [`/api/users/${user.id}/attended-activities`] : [],
    retry: 1,
    enabled: showUserActivities && !!user,
  });

  // Combine hosted and attended activities
  const allActivities = showUserActivities ? [...activities, ...attendedActivities] : activities;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  const openProfileModal = (match: any) => {
    setSelectedMatch(match);
    setIsModalOpen(true);
  };

  const closeProfileModal = () => {
    setIsModalOpen(false);
    setSelectedMatch(null);
  };

  const sendFriendRequest = (userId: string) => {
    // Call API to send friend request
    console.log(`Sending friend request to user ${userId}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 pb-20 min-h-screen">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {showUserActivities ? "My Activities" : "Your Matches"}
          </h2>
          <p className="text-sm text-gray-500">
            {showUserActivities ? "Activities you've joined" : "Events you're part of"}
          </p>
        </div>
        {allActivities.length > 0 && !showUserActivities && (
          <Button onClick={() => openProfileModal(allActivities[0])} variant="outline">
            View Group Profiles
          </Button>
        )}
      </header>

      <div className="p-4 space-y-4">
        {allActivities.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {showUserActivities ? "No activities yet" : "No matches yet"}
            </h3>
            <p className="text-gray-500">
              {showUserActivities ? "Create or join activities to see them here!" : "Start swiping to find activities you love!"}
            </p>
          </div>
        ) : (
          allActivities.map((activity: any) => (
            <Card key={activity.id} className="bg-white shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0 overflow-hidden">
                    {activity.imageUrl || activity.imageUrls?.[0] ? (
                      <img 
                        src={activity.imageUrl || activity.imageUrls?.[0]} 
                        alt={activity.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
                        <span className="text-primary font-semibold text-lg">
                          {activity.title.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {activity.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {format(new Date(activity.time || activity.dateTime), 'MMM d, h:mm a')}
                    </p>
                    <div className="mt-1">
                      {showUserActivities ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          {activity.host?.id === user?.id ? 'Hosting' : 'Joined'}
                        </Badge>
                      ) : (
                        getStatusBadge(activity.status)
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    {showUserActivities ? (
                      <Button 
                        size="sm"
                        onClick={() => onOpenChat(activity.id)}
                        className="w-10 h-10 p-0 bg-primary rounded-full relative"
                      >
                        <MessageCircle className="w-5 h-5 text-white" />
                      </Button>
                    ) : activity.status === 'approved' ? (
                      <Button 
                        size="sm"
                        onClick={() => onOpenChat(activity.activity?.id || activity.id)}
                        className="w-10 h-10 p-0 bg-primary rounded-full relative"
                      >
                        <MessageCircle className="w-5 h-5 text-white" />
                      </Button>
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Clock className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Profile Modal */}
      <Dialog open={isModalOpen} onOpenChange={closeProfileModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Group Profiles</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedMatch?.participants?.map((participant: any) => (
              <div key={participant.id} className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage src={participant.profileImageUrl} alt={participant.firstName} />
                  <AvatarFallback>{participant.firstName[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">{participant.firstName} {participant.lastName}</h4>
                  <p className="text-sm text-gray-500">{participant.email}</p>
                </div>
                <Button onClick={() => sendFriendRequest(participant.id)} size="sm">
                  Add Friend
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
