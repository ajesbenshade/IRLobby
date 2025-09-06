import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Clock, Users, Star } from "lucide-react";
import { format } from "date-fns";
import type { Activity } from "@shared/client-types";

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

export default function SwipeCard({ 
  activity, 
  onSwipeLeft, 
  onSwipeRight, 
  onShowDetails,
  className = ""
}: SwipeCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartPos({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const deltaX = e.touches[0].clientX - startPos.x;
    const deltaY = e.touches[0].clientY - startPos.y;

    // Only handle horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      setDragOffset({ x: deltaX, y: 0 });
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 100;
    
    if (Math.abs(dragOffset.x) > threshold) {
      if (dragOffset.x > 0) {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    }
    
    // Reset position
    setDragOffset({ x: 0, y: 0 });
  };

  const rotation = dragOffset.x * 0.1;
  const opacity = 1 - Math.abs(dragOffset.x) / 300;

  const hostName = activity.host?.firstName && activity.host?.lastName
    ? `${activity.host.firstName} ${activity.host.lastName}`
    : 'Anonymous Host';

  const hostInitials = activity.host?.firstName && activity.host?.lastName
    ? `${activity.host.firstName.charAt(0)}${activity.host.lastName.charAt(0)}`
    : 'H';

  return (
    <Card 
      ref={cardRef}
      className={`bg-white rounded-2xl shadow-xl cursor-grab active:cursor-grabbing select-none ${className}`}
      style={{
        transform: `translateX(${dragOffset.x}px) rotate(${rotation}deg)`,
        opacity,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={onShowDetails}
    >
      <CardContent className="p-0">
        {/* Activity Image */}
        <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-t-2xl flex items-center justify-center overflow-hidden">
          {activity.imageUrl ? (
            <img 
              src={activity.imageUrl} 
              alt={activity.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-white text-xl font-bold">
                  {activity.title.charAt(0)}
                </span>
              </div>
              <p className="text-white/80 font-medium">{activity.category}</p>
            </div>
          )}
        </div>

        <div className="p-4">
          {/* Title and Category */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-800 truncate flex-1 mr-2">
              {activity.title}
            </h3>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 flex-shrink-0">
              {activity.category}
            </Badge>
          </div>

          {/* Location */}
          <div className="flex items-center text-gray-600 mb-2">
            <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="text-sm truncate">{activity.location}</span>
          </div>

          {/* Date/Time */}
          <div className="flex items-center text-gray-600 mb-3">
            <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="text-sm">
              {format(new Date(activity.dateTime), 'MMM d, h:mm a')}
            </span>
          </div>

          {/* Description */}
          {activity.description && (
            <p className="text-gray-700 text-sm mb-4 line-clamp-2">
              {activity.description}
            </p>
          )}

          {/* Participants */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2 text-gray-500" />
              <span className="text-sm text-gray-600">
                {activity.currentParticipants || 0}/{activity.maxParticipants} people
              </span>
            </div>
            {activity.price && activity.price > 0 && (
              <span className="text-sm font-medium text-green-600">
                ${activity.price}
              </span>
            )}
          </div>

          {/* Host Info */}
          <div className="pt-4 border-t border-gray-100 flex items-center">
            <Avatar className="w-10 h-10 mr-3">
              <AvatarImage src={activity.host?.profileImageUrl} />
              <AvatarFallback className="text-sm">
                {hostInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{hostName}</p>
              <p className="text-xs text-gray-500">
                Host • {activity.host?.eventsHosted || 0} events
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
}
