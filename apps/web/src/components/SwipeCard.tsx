import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Activity } from '@/types/activity';
import { format, isValid } from 'date-fns';
import { MapPin, Clock, Users, Star, X, Heart, Info } from 'lucide-react';
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
  disabled?: boolean;
}

// Memoize the component to prevent unnecessary re-renders
export default memo(function SwipeCard({
  activity,
  onSwipeLeft,
  onSwipeRight,
  onShowDetails,
  className = '',
  disabled = false,
}: SwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  // Track whether the pointer/touch actually moved enough to be considered a drag
  const wasDraggedRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      setIsDragging(true);
      setStartPos({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      });
      wasDraggedRef.current = false;
    },
    [disabled],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !isDragging) return;

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
    [disabled, isDragging, startPos],
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled || !isDragging) return;
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
  }, [disabled, isDragging, dragOffset, onSwipeLeft, onSwipeRight]);

  // Mouse support for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    // Only left button
    if (e.button !== 0) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    wasDraggedRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled || !isDragging) return;
    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      setDragOffset({ x: deltaX, y: 0 });
      if (Math.abs(deltaX) > 5) wasDraggedRef.current = true;
    }
  };

  const handleMouseUp = () => {
    if (disabled || !isDragging) return;
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSwipeLeft();
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSwipeRight();
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onShowDetails();
    }
  };

  const rotation = dragOffset.x * 0.1;
  const opacity = 1 - Math.abs(dragOffset.x) / 300;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hostName =
    activity.host?.firstName && activity.host?.lastName
      ? `${activity.host.firstName} ${activity.host.lastName}`
      : 'Anonymous Host';

  const hostInitials =
    activity.host?.firstName && activity.host?.lastName
      ? `${activity.host.firstName.charAt(0)}${activity.host.lastName.charAt(0)}`
      : 'H';
  const safeTitle = activity.title || 'Untitled Activity';
  const rawTags = activity.tags as unknown;
  const safeTags = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === 'string' && rawTags.trim().length > 0
      ? [rawTags]
      : [];

  const rawActivityTime =
    activity.time ||
    (activity as Activity & { dateTime?: string; date_time?: string }).dateTime ||
    (activity as Activity & { dateTime?: string; date_time?: string }).date_time;
  const parsedActivityDate = rawActivityTime ? new Date(rawActivityTime) : null;
  const formattedActivityTime =
    parsedActivityDate && isValid(parsedActivityDate)
      ? format(parsedActivityDate, 'MMM d, h:mm a')
      : 'Time TBD';

  return (
    <Card
      ref={cardRef}
      className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-gray-900/50 cursor-grab active:cursor-grabbing select-none outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:focus-visible:ring-offset-gray-900 ${
        disabled ? 'pointer-events-none opacity-80' : ''
      } ${className}`}
      style={{
        // Allow the browser to handle vertical scrolling while enabling horizontal swipe gestures
        touchAction: 'pan-y',
        transform: `translateX(${dragOffset.x}px) rotate(${rotation}deg)`,
        opacity,
        transition:
          isDragging || prefersReducedMotion
            ? 'none'
            : 'transform 0.3s ease-out, opacity 0.3s ease-out',
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${safeTitle}. Press left arrow to pass, right arrow to join, or enter to view details.`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
      onClick={() => {
        if (!disabled && !wasDraggedRef.current) onShowDetails();
      }}
    >
      <CardContent className="p-0">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute left-4 top-4 z-10 rounded-full border-2 border-red-400 bg-white/90 px-4 py-2 text-sm font-bold uppercase tracking-wide text-red-500 shadow-sm transition-opacity ${
            dragOffset.x < -32 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Pass
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute right-4 top-4 z-10 rounded-full border-2 border-emerald-400 bg-white/90 px-4 py-2 text-sm font-bold uppercase tracking-wide text-emerald-600 shadow-sm transition-opacity ${
            dragOffset.x > 32 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Join
        </div>

        {/* Activity Image */}
        <div className="w-full h-40 sm:h-48 bg-gradient-to-br from-primary/20 to-purple-600/20 dark:from-primary/30 dark:to-purple-600/30 rounded-t-2xl flex items-center justify-center overflow-hidden">
          {activity.images && activity.images.length > 0 ? (
            <img src={activity.images[0]} alt={safeTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white text-xl font-bold">{safeTitle.charAt(0)}</span>
              </div>
              <p className="text-white/80 font-medium">
                {safeTags.length > 0 ? safeTags[0] : 'Activity'}
              </p>
            </div>
          )}
        </div>

        <div className="p-4">
          {/* Title and Category */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate flex-1 mr-2">
              {safeTitle}
            </h3>
            <Badge
              variant="secondary"
              className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 flex-shrink-0"
            >
              {safeTags.length > 0 ? safeTags[0] : 'Activity'}
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
            <span className="text-sm">{formattedActivityTime}</span>
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
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{hostName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Host{' '}
                <span aria-hidden="true" className="mx-1">
                  &bull;
                </span>
                {activity.host?.eventsHosted || 0} events
              </p>
            </div>
            {activity.host?.rating && (
              <div className="flex items-center">
                <Star className="w-4 h-4 text-yellow-500 mr-1" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {activity.host.rating.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onSwipeLeft();
              }}
              disabled={disabled}
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-950/30"
              aria-label={`Pass on ${safeTitle}`}
            >
              <X className="mr-1 h-4 w-4" aria-hidden="true" />
              Pass
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onShowDetails();
              }}
              disabled={disabled}
              aria-label={`View details for ${safeTitle}`}
            >
              <Info className="mr-1 h-4 w-4" aria-hidden="true" />
              Details
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onSwipeRight();
              }}
              disabled={disabled}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/70 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              aria-label={`Join ${safeTitle}`}
            >
              <Heart className="mr-1 h-4 w-4" aria-hidden="true" />
              Join
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
