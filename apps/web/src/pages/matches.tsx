import { ListSkeleton, PageState } from '@/components/AppState';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { API_ROUTES } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MessageCircle, Clock, CheckCircle, RefreshCw, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  showUserActivities?: boolean;
}

export default function Matches({ showUserActivities = false }: MatchesProps) {
  const navigate = useNavigate();
  const {
    data: matches = [],
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery<Match[]>({
    queryKey: [API_ROUTES.MATCHES],
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
      <div className="min-h-screen bg-gray-50 pb-20 dark:bg-gray-900">
        <header className="flex items-center justify-between bg-white p-4 shadow-sm dark:bg-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {showUserActivities ? 'My Activities' : 'Matches'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {showUserActivities ? "Activities you've joined" : 'People who matched with you'}
            </p>
          </div>
        </header>
        <ListSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <PageState
        icon={WifiOff}
        title="Unable to load matches"
        description={error instanceof Error ? error.message : 'Please try again in a moment.'}
        actionLabel="Retry"
        onAction={() => void refetch()}
        isActionLoading={isRefetching}
        tone="danger"
        className="min-h-screen bg-gray-50 dark:bg-gray-900"
      />
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
          <PageState
            icon={showUserActivities ? RefreshCw : MessageCircle}
            title={showUserActivities ? 'No joined activities yet' : 'No matches yet'}
            description={
              showUserActivities
                ? 'When you join a plan, it will appear here with its latest status.'
                : 'Start swiping through nearby plans to find people and activities you want to meet around.'
            }
            actionLabel="Open discovery"
            onAction={() => navigate('/app/discovery')}
            className="min-h-[55vh]"
          />
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
                        onClick={() => navigate(`/app/matches/${match.id}/chat`)}
                        className="w-10 h-10 p-0 bg-primary rounded-full relative"
                        aria-label={`Open chat for ${match.activity.title}`}
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
