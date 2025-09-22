import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageCircle, Clock, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface MatchParticipant {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  profileImageUrl?: string;
  isHost?: boolean;
}

interface MatchActivity {
  id: number;
  title: string;
  dateTime: string;
  imageUrl?: string;
}

interface Match {
  id: number;
  status: string;
  activity: MatchActivity;
  participants: MatchParticipant[];
}

interface MatchesProps {
  onOpenChat: (activityId: number) => void;
  showUserActivities?: boolean;
}

export default function Matches({ onOpenChat, showUserActivities = false }: MatchesProps) {
  const { data: matches = [], isLoading } = useQuery<Match[]>({
    queryKey: ['/api/matches'],
    retry: 1,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const openProfileModal = (match: Match) => {
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
          <Badge
            variant="secondary"
            className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        );
      case 'pending':
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
          >
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
    <div className="bg-gray-50 dark:bg-gray-900 pb-20 min-h-screen">
      <header className="bg-white dark:bg-gray-800 shadow-sm p-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {showUserActivities ? 'My Activities' : 'Matches'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {showUserActivities ? "Activities you've joined" : 'People who matched with you'}
          </p>
        </div>
        {matches.length > 0 && (
          <Button onClick={() => openProfileModal(matches[0])} variant="outline">
            View Group Profiles
          </Button>
        )}
      </header>

      <div className="p-4 space-y-4">
        {matches.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No matches yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Start swiping to find activities you love!
            </p>
          </div>
        ) : (
          matches.map((match) => (
            <Card
              key={match.id}
              className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md dark:hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0 overflow-hidden">
                    {match.activity.imageUrl ? (
                      <img
                        src={match.activity.imageUrl}
                        alt={match.activity.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
                        <span className="text-primary font-semibold text-lg">
                          {match.activity.title.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{match.activity.title}</h3>
                    <p className="text-sm text-gray-600">
                      {format(new Date(match.activity.dateTime), 'MMM d, h:mm a')}
                    </p>
                    <div className="mt-1">{getStatusBadge(match.status)}</div>
                  </div>

                  <div className="flex-shrink-0">
                    {match.status === 'approved' ? (
                      <Button
                        size="sm"
                        onClick={() => onOpenChat(match.activity.id)}
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
            {selectedMatch?.participants?.map((participant) => (
              <div key={participant.id} className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage
                    src={participant.profileImageUrl}
                    alt={participant.firstName ?? participant.email ?? 'Participant'}
                  />
                  <AvatarFallback>
                    {participant.firstName?.[0] ?? participant.email?.[0] ?? '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">
                    {participant.firstName} {participant.lastName}
                  </h4>
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
