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
      <div className="aspect-video bg-gradient-to-br from-primary to-primary-deep relative overflow-hidden">
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
          <Badge className="bg-primary text-primary-foreground">{activity.category}</Badge>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground truncate">{activity.title}</h3>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center text-muted-foreground">
            <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm truncate">{activity.location}</span>
          </div>

          <div className="flex items-center text-muted-foreground">
            <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm">
              {activity.dateTime ? format(new Date(activity.dateTime), 'MMM d, h:mm a') : ''}
            </span>
          </div>

          <div className="flex items-center text-muted-foreground">
            <Users className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="text-sm">
              {participantCount}/{maxParticipants} people
            </span>
          </div>
        </div>

        <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{activity.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {activity.participants && activity.participants.length > 0 && (
              <div className="flex -space-x-2 mr-2">
                {activity.participants
                  .slice(0, 3)
                  .map((participant: Participant, index: number) => (
                    <div
                      key={index}
                      className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden"
                    >
                      {participant.user?.profileImageUrl ? (
                        <img
                          src={participant.user.profileImageUrl}
                          alt="Participant"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">
                          {participant.user?.firstName?.charAt(0) || '?'}
                        </span>
                      )}
                    </div>
                  ))}
                {activity.participants.length > 3 && (
                  <div className="w-8 h-8 bg-muted rounded-full border-2 border-background flex items-center justify-center">
                    <span className="text-xs font-medium text-muted-foreground">
                      +{activity.participants.length - 3}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {activity.host && (
            <div className="flex items-center">
              <Star className="h-4 w-4 text-accent mr-1" />
              <span className="text-sm font-medium text-foreground">{hostRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {activity.host && (
          <div className="mt-4 pt-4 border-t border-border flex items-center">
            <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
              {activity.host.profileImageUrl ? (
                <img
                  src={activity.host.profileImageUrl}
                  alt="Host"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-primary-deep flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {activity.host.firstName?.charAt(0) || activity.host.email?.charAt(0) || 'H'}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {activity.host.firstName && activity.host.lastName
                  ? `${activity.host.firstName} ${activity.host.lastName}`
                  : activity.host.email?.split('@')[0] || 'Host'}
              </p>
              <p className="text-xs text-muted-foreground">Host</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
