import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActivityCard } from "./activity-card";
import { Button } from "@/components/ui/button";
import { X, Heart, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Activity } from "@shared/client-types";

interface SwipeStackProps {
  activities: Activity[];
  onActivitySelect: (activity: Activity) => void;
  onMatchSuccess: (activity: Activity) => void;
  onSwipeComplete: () => void;
}

export function SwipeStack({ 
  activities, 
  onActivitySelect, 
  onMatchSuccess,
  onSwipeComplete 
}: SwipeStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draggedCard, setDraggedCard] = useState<{
    index: number;
    x: number;
    y: number;
    rotation: number;
    opacity: number;
  } | null>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const swipeMutation = useMutation({
    mutationFn: async ({ activityId, direction }: { activityId: string; direction: string }) => {
      const response = await apiRequest("POST", "/api/swipes", {
        activityId,
        direction,
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (data.matched && variables.direction === "right") {
        const activity = activities[currentIndex];
        onMatchSuccess(activity);
      }
      
      // Move to next card
      setCurrentIndex(prev => prev + 1);
      
      // If we're near the end, fetch more activities
      if (currentIndex >= activities.length - 2) {
        onSwipeComplete();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to swipe",
        variant: "destructive",
      });
    },
  });

  const handleSwipe = (direction: "left" | "right") => {
    if (currentIndex >= activities.length) return;
    
    const activity = activities[currentIndex];
    swipeMutation.mutate({
      activityId: activity.id.toString(),
      direction,
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (currentIndex >= activities.length) return;
    
    const touch = e.touches[0];
    setDraggedCard({
      index: currentIndex,
      x: 0,
      y: 0,
      rotation: 0,
      opacity: 1,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedCard || currentIndex >= activities.length) return;
    
    const touch = e.touches[0];
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = touch.clientX - centerX;
    const deltaY = touch.clientY - centerY;
    
    const rotation = deltaX * 0.1;
    const opacity = Math.max(0.5, 1 - Math.abs(deltaX) / 300);
    
    setDraggedCard({
      index: currentIndex,
      x: deltaX,
      y: deltaY,
      rotation,
      opacity,
    });
  };

  const handleTouchEnd = () => {
    if (!draggedCard || currentIndex >= activities.length) return;
    
    const threshold = 100;
    
    if (Math.abs(draggedCard.x) > threshold) {
      const direction = draggedCard.x > 0 ? "right" : "left";
      handleSwipe(direction);
    }
    
    setDraggedCard(null);
  };

  if (activities.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">No more activities</h3>
          <p className="text-gray-400">Check back later for new events!</p>
        </div>
      </div>
    );
  }

  if (currentIndex >= activities.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">You're all caught up!</h3>
          <p className="text-gray-400">Check back later for new activities.</p>
        </div>
      </div>
    );
  }

  const visibleCards = activities.slice(currentIndex, currentIndex + 3);

  return (
    <div className="relative h-full">
      {/* Card Stack */}
      <div className="relative h-full">
        {visibleCards.map((activity, index) => {
          const isActive = index === 0;
          const absoluteIndex = currentIndex + index;
          
          let style: React.CSSProperties = {
            position: "absolute",
            top: index * 4,
            left: 4,
            right: 4,
            zIndex: 3 - index,
            transform: `scale(${1 - index * 0.02})`,
            opacity: 1 - index * 0.2,
          };

          // Apply drag transformation to active card
          if (isActive && draggedCard && draggedCard.index === absoluteIndex) {
            style.transform = `translateX(${draggedCard.x}px) translateY(${draggedCard.y}px) rotate(${draggedCard.rotation}deg) scale(1)`;
            style.opacity = draggedCard.opacity;
            style.transition = "none";
          } else if (isActive) {
            style.transition = "transform 0.2s ease-out, opacity 0.2s ease-out";
          }

          return (
            <div
              key={activity.id}
              ref={isActive ? cardRef : undefined}
              style={style}
              onTouchStart={isActive ? handleTouchStart : undefined}
              onTouchMove={isActive ? handleTouchMove : undefined}
              onTouchEnd={isActive ? handleTouchEnd : undefined}
            >
              <ActivityCard activity={activity} />
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-6">
        <Button
          onClick={() => handleSwipe("left")}
          disabled={swipeMutation.isPending}
          className="w-16 h-16 rounded-full bg-white border-2 border-red-500 text-red-500 hover:bg-red-50 shadow-lg"
        >
          <X className="h-6 w-6" />
        </Button>
        
        <Button
          onClick={() => onActivitySelect(activities[currentIndex])}
          disabled={swipeMutation.isPending}
          className="w-12 h-12 rounded-full bg-white border-2 border-gray-300 text-gray-600 hover:bg-gray-50 shadow-lg"
        >
          <Info className="h-4 w-4" />
        </Button>
        
        <Button
          onClick={() => handleSwipe("right")}
          disabled={swipeMutation.isPending}
          className="w-16 h-16 rounded-full bg-white border-2 border-green-500 text-green-500 hover:bg-green-50 shadow-lg"
        >
          <Heart className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
