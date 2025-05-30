import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users, List } from "lucide-react";
import { format } from "date-fns";

interface MapViewProps {
  onActivitySelect: (activity: any) => void;
  onToggleView: () => void;
  filters: any;
}

export default function MapView({ onActivitySelect, onToggleView, filters }: MapViewProps) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["/api/activities/discover", filters],
  });

  const filteredActivities = activities.filter((activity: any) => {
    if (filters.category && filters.category !== 'all' && activity.category !== filters.category) {
      return false;
    }
    if (filters.skillLevel && filters.skillLevel !== 'all' && activity.skillLevel !== filters.skillLevel) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleView}
            className="flex items-center gap-2"
          >
            <List className="h-4 w-4" />
            Card View
          </Button>
        </div>
        
        <div className="text-sm text-gray-600">
          {filteredActivities.length} activities available
        </div>
      </div>

      {/* Activities List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
            <p className="text-gray-500">Try adjusting your filters or check back later for new activities.</p>
          </div>
        ) : (
          filteredActivities.map((activity: any) => (
            <Card 
              key={activity.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onActivitySelect(activity)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900">{activity.title}</h3>
                    <div className="flex items-center text-gray-600 text-sm mt-1">
                      <MapPin className="h-4 w-4 mr-1" />
                      {activity.location}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {activity.category}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {format(new Date(activity.dateTime), 'MMM d, h:mm a')}
                  </div>
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {activity.currentParticipants || 0}/{activity.maxParticipants}
                  </div>
                </div>

                {activity.description && (
                  <p className="text-gray-700 text-sm line-clamp-2 mb-3">
                    {activity.description}
                  </p>
                )}

                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    {activity.skillLevel && (
                      <Badge variant="outline" className="text-xs">
                        {activity.skillLevel}
                      </Badge>
                    )}
                    {activity.isPrivate && (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
                        Private
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" onClick={(e) => {
                    e.stopPropagation();
                    onActivitySelect(activity);
                  }}>
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}