import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { MapPin, Clock, Users, Star } from 'lucide-react';

interface User {
  profileImageUrl?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  rating?: string;
}

interface Participant {
  user: User;
}

interface Activity {
  title: string;
  imageUrl?: string;
  category: string;
  location: string;
  dateTime?: string;
  currentParticipants?: number;
  maxParticipants: number;
  description: string;
}

interface ActivityCardProps {
  activity: Activity & {
    host?: User;
    participants?: Participant[];
    location?: string;
  };
  onClick?: () => void;
  className?: string;
}

export function ActivityCard({ activity, onClick, className = '' }: ActivityCardProps) {
  const participantCount = activity.currentParticipants || 0;
  const maxParticipants = activity.maxParticipants;
  const hostRating = activity.host?.rating ? parseFloat(activity.host.rating) : 0;

  return (
    <Card className={`swipe-card overflow-hidden ${className}`} onClick={onClick}>
      <div className="aspect-video bg-gradient-to-br from-primary to-purple-600 relative overflow-hidden">
        {activity.imageUrl ? (
          <img
            src={activity.imageUrl}
            alt={activity.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white text-4xl font-bold">{activity.title.charAt(0)}</span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <Badge className="bg-secondary text-white">{activity.category}</Badge>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-800 truncate">{activity.title}</h3>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center text-gray-600">
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm truncate">{activity.location}</span>
          </div>

          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm">
              {activity.dateTime ? format(new Date(activity.dateTime), 'MMM d, h:mm a') : ''}
            </span>
          </div>

          <div className="flex items-center text-gray-600">
            <Users className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm">
              {participantCount}/{maxParticipants} people
            </span>
          </div>
        </div>

        <p className="text-gray-700 text-sm mb-4 line-clamp-3">{activity.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {activity.participants && activity.participants.length > 0 && (
              <div className="flex -space-x-2 mr-2">
                {activity.participants
                  .slice(0, 3)
                  .map((participant: Participant, index: number) => (
                    <div
                      key={index}
                      className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center overflow-hidden"
                    >
                      {participant.user?.profileImageUrl ? (
                        <img
                          src={participant.user.profileImageUrl}
                          alt="Participant"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-medium text-gray-600">
                          {participant.user?.firstName?.charAt(0) || '?'}
                        </span>
                      )}
                    </div>
                  ))}
                {activity.participants.length > 3 && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">
                      +{activity.participants.length - 3}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {activity.host && (
            <div className="flex items-center">
              <Star className="h-4 w-4 text-secondary mr-1" />
              <span className="text-sm font-medium text-gray-700">{hostRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {activity.host && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center">
            <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
              {activity.host.profileImageUrl ? (
                <img
                  src={activity.host.profileImageUrl}
                  alt="Host"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {activity.host.firstName?.charAt(0) || activity.host.email?.charAt(0) || 'H'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">
                {activity.host.firstName && activity.host.lastName
                  ? `${activity.host.firstName} ${activity.host.lastName}`
                  : activity.host.email?.split('@')[0] || 'Host'}
              </p>
              <p className="text-xs text-gray-500">Host</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
