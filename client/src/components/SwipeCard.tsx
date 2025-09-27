import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Activity } from '@/types/activity';
import { format } from 'date-fns';
import { MapPin, Clock, Users, Star } from 'lucide-react';
import { useState, useRef, useCallback, memo } from 'react';

interface SwipeCardProps {
  activity: Activity & {
    host?: {
      firstName?: string;
      lastName?: string;
      profileImageUrl?: string;
      rating?: number;
      eventsHosted?: number;
    };
  };
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onShowDetails: () => void;
  className?: string;
}

// Memoize the component to prevent unnecessary re-renders
export default memo(function SwipeCard({
  activity,
  onSwipeLeft,
  onSwipeRight,
  onShowDetails,
  className = '',
}: SwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  // Track whether the pointer/touch actually moved enough to be considered a drag
  const wasDraggedRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    setStartPos({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
    wasDraggedRef.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;

      const deltaX = e.touches[0].clientX - startPos.x;
      const deltaY = e.touches[0].clientY - startPos.y;

      // Only handle horizontal swipes and add velocity for smoother experience
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
        // Add resistance for more natural feel
        const resistance = Math.min(Math.abs(deltaX) / 200, 1);
        setDragOffset({ x: deltaX * resistance, y: 0 });
        // mark that a drag occurred so clicks won't fire
        if (Math.abs(deltaX) > 5) wasDraggedRef.current = true;
      }
    },
    [isDragging, startPos],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100;
    const velocity = Math.abs(dragOffset.x) / 200; // Simple velocity calculation

    if (Math.abs(dragOffset.x) > threshold || velocity > 0.5) {
      if (dragOffset.x > 0) {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    }

    // Reset position with animation
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 50);
    setDragOffset({ x: 0, y: 0 });
  }, [isDragging, dragOffset, onSwipeLeft, onSwipeRight]);

  // Mouse support for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only left button
    if (e.button !== 0) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    wasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      setDragOffset({ x: deltaX, y: 0 });
      if (Math.abs(deltaX) > 5) wasDraggedRef.current = true;
    }
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const threshold = 100;
    if (Math.abs(dragOffset.x) > threshold) {
      if (dragOffset.x > 0) onSwipeRight();
      else onSwipeLeft();
    }
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 50);
    setDragOffset({ x: 0, y: 0 });
  };

  const handleTouchCancel = () => {
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    wasDraggedRef.current = false;
  };

  const rotation = dragOffset.x * 0.1;
  const opacity = 1 - Math.abs(dragOffset.x) / 300;

  const hostName =
    activity.host?.firstName && activity.host?.lastName
      ? `${activity.host.firstName} ${activity.host.lastName}`
      : 'Anonymous Host';

  const hostInitials =
    activity.host?.firstName && activity.host?.lastName
      ? `${activity.host.firstName.charAt(0)}${activity.host.lastName.charAt(0)}`
      : 'H';

  return (
    <Card
      ref={cardRef}
      className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-gray-900/50 cursor-grab active:cursor-grabbing select-none ${className}`}
      style={{
        // Allow the browser to handle vertical scrolling while enabling horizontal swipe gestures
        touchAction: 'pan-y',
        transform: `translateX(${dragOffset.x}px) rotate(${rotation}deg)`,
        opacity,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => {
        if (!wasDraggedRef.current) onShowDetails();
      }}
    >
      <CardContent className="p-0">
        {/* Activity Image */}
        <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-purple-600/20 dark:from-primary/30 dark:to-purple-600/30 rounded-t-2xl flex items-center justify-center overflow-hidden">
          {activity.images && activity.images.length > 0 ? (
            <img
              src={activity.images[0]}
              alt={activity.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white text-xl font-bold">{activity.title.charAt(0)}</span>
              </div>
              <p className="text-white/80 font-medium">
                {activity.tags && activity.tags.length > 0 ? activity.tags[0] : 'Activity'}
              </p>
            </div>
          )}
        </div>

        <div className="p-4">
          {/* Title and Category */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate flex-1 mr-2">
              {activity.title}
            </h3>
            <Badge
              variant="secondary"
              className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 flex-shrink-0"
            >
              {activity.tags && activity.tags.length > 0 ? activity.tags[0] : 'Activity'}
            </Badge>
          </div>

          {/* Location */}
          <div className="flex items-center text-gray-600 dark:text-gray-300 mb-2">
            <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="text-sm truncate">{activity.location}</span>
          </div>

          {/* Date/Time */}
          <div className="flex items-center text-gray-600 dark:text-gray-300 mb-3">
            <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="text-sm">{format(new Date(activity.time), 'MMM d, h:mm a')}</span>
          </div>

          {/* Description */}
          {activity.description && (
            <p className="text-gray-700 dark:text-gray-200 text-sm mb-4 line-clamp-2">
              {activity.description}
            </p>
          )}

          {/* Participants */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {activity.participant_count || 0}/{activity.capacity} people
              </span>
            </div>
          </div>

          {/* Host Info */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center">
            <Avatar className="w-10 h-10 mr-3">
              <AvatarImage src={activity.host?.profileImageUrl} />
              <AvatarFallback className="text-sm">{hostInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{hostName}</p>
              <p className="text-xs text-gray-500">
                Host <span aria-hidden="true" className="mx-1">&bull;</span>{activity.host?.eventsHosted || 0} events
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
      </CardContent>
    </Card>
  );
});
