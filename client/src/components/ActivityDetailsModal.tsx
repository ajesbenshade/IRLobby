import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Activity } from '@/types/activity';
import { format } from 'date-fns';
import { MapPin, Clock, Users, Star } from 'lucide-react';

interface ActivityDetailsModalProps {
  activity: Activity & {
    host?: {
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
      rating?: number;
      eventsHosted?: number;
    };
  };
  isOpen: boolean;
  onClose: () => void;
  onJoin: () => void;
}

export default function ActivityDetailsModal({
  activity,
  isOpen,
  onClose,
  onJoin,
}: ActivityDetailsModalProps) {
  const hostName =
    activity.host?.firstName && activity.host?.lastName
      ? `${activity.host.firstName} ${activity.host.lastName}`
      : 'Anonymous Host';

  const hostInitials =
    activity.host?.firstName && activity.host?.lastName
      ? `${activity.host.firstName.charAt(0)}${activity.host.lastName.charAt(0)}`
      : 'H';

  const handleJoin = () => {
    onJoin();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Activity Details</DialogTitle>
        </DialogHeader>

        {/* Activity Image */}
        <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-xl mb-4 overflow-hidden">
          {activity.images && activity.images.length > 0 ? (
            <img
              src={activity.images[0]}
              alt={activity.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-white text-xl font-bold">{activity.title.charAt(0)}</span>
                </div>
                <p className="text-white/80 font-medium">
                  {activity.tags && activity.tags.length > 0 ? activity.tags[0] : 'Activity'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Title and Category */}
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex-1 mr-2">{activity.title}</h2>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            {activity.tags && activity.tags.length > 0 ? activity.tags[0] : 'Activity'}
          </Badge>
        </div>

        {/* Activity Details */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center text-gray-600">
            <MapPin className="w-5 h-5 mr-3 flex-shrink-0" />
            <span>{activity.location}</span>
          </div>

          <div className="flex items-center text-gray-600">
            <Clock className="w-5 h-5 mr-3 flex-shrink-0" />
            <span>
              {format(new Date(activity.time), 'EEEE, MMM d, yyyy')}
              <span aria-hidden="true" className="mx-1">&bull;</span>
              {format(new Date(activity.time), 'h:mm a')}
            </span>
          </div>

          <div className="flex items-center text-gray-600">
            <Users className="w-5 h-5 mr-3 flex-shrink-0" />
            <span>
              {activity.participant_count || 0} of {activity.capacity} spots filled
            </span>
          </div>
        </div>

        {/* Description */}
        {activity.description && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">What to expect</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{activity.description}</p>
          </div>
        )}

        {/* Tags */}
        {activity.tags && activity.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {activity.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Host Information */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-800 mb-3">Hosted by</h3>
          <div className="flex items-center">
            <Avatar className="w-12 h-12 mr-3">
              <AvatarImage src={activity.host?.profileImageUrl} />
              <AvatarFallback>{hostInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{hostName}</p>
              <p className="text-sm text-gray-500">
                {activity.host?.eventsHosted || 0} events hosted
              </p>
            </div>
            {activity.host?.rating && (
              <div className="flex items-center">
                <Star className="w-4 h-4 text-yellow-500 mr-1" />
                <span className="text-sm font-medium text-gray-700">
                  {activity.host.rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button onClick={handleJoin} className="flex-1 bg-green-600 hover:bg-green-700">
            Join Event
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
