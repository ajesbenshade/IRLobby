import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Calendar, Users, Filter, List } from "lucide-react";
import { format } from "date-fns";

interface MapViewProps {
  onActivitySelect: (activity: any) => void;
  onToggleView: () => void;
  filters: any;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

export default function MapView({ onActivitySelect, onToggleView, filters }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['/api/activities/nearby', userLocation?.latitude, userLocation?.longitude, filters],
    queryFn: async () => {
      if (!userLocation) return [];
      
      const params = new URLSearchParams({
        latitude: userLocation.latitude.toString(),
        longitude: userLocation.longitude.toString(),
        maxDistance: '100',
        ...Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [key, String(value)])
        )
      });
      
      const response = await fetch(`/api/activities/nearby?${params}`);
      if (!response.ok) throw new Error('Failed to fetch nearby activities');
      return response.json();
    },
    enabled: !!userLocation,
    retry: 1,
  });

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationError(null);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Location access denied. Please enable location permissions to find nearby activities.");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("An unknown error occurred while retrieving location.");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      "Sports & Fitness": "bg-red-100 text-red-700",
      "Food & Drinks": "bg-orange-100 text-orange-700",
      "Outdoor Adventures": "bg-green-100 text-green-700",
      "Arts & Culture": "bg-purple-100 text-purple-700",
      "Nightlife": "bg-pink-100 text-pink-700",
      "Learning": "bg-blue-100 text-blue-700",
      "Technology": "bg-gray-100 text-gray-700",
      "Music": "bg-indigo-100 text-indigo-700",
      "Social": "bg-yellow-100 text-yellow-700",
      "Gaming": "bg-cyan-100 text-cyan-700",
    };
    return colors[category] || "bg-gray-100 text-gray-700";
  };

  if (locationError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Location Required</h3>
            <p className="text-gray-600 mb-4">{locationError}</p>
            <Button onClick={requestLocation} className="w-full">
              <Navigation className="w-4 h-4 mr-2" />
              Enable Location
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userLocation || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-gray-500">Finding nearby activities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Map View</h2>
          <p className="text-sm text-gray-500">
            {activities.length} activities within {filters.maxDistance?.[0] || 25} miles
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleView}>
          <List className="w-4 h-4 mr-1" />
          List View
        </Button>
      </div>

      {/* Map Placeholder */}
      <div className="relative bg-gray-100 h-64 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <MapPin className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm">Interactive map would be integrated here</p>
          <p className="text-xs">Using services like Google Maps or Mapbox</p>
        </div>
        
        {/* Location marker overlay */}
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2">
          <div className="flex items-center gap-2 text-sm">
            <Navigation className="w-4 h-4 text-blue-500" />
            <span>Your Location</span>
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activities.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No activities found nearby</p>
              <p className="text-sm text-gray-400">Try adjusting your distance filter</p>
            </CardContent>
          </Card>
        ) : (
          activities.map((activity: any) => {
            const distance = userLocation && activity.latitude && activity.longitude
              ? calculateDistance(
                  userLocation.latitude,
                  userLocation.longitude,
                  activity.latitude,
                  activity.longitude
                )
              : null;

            return (
              <Card 
                key={activity.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onActivitySelect(activity)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg truncate flex-1 pr-2">
                      {activity.title}
                    </h3>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getCategoryColor(activity.category)}`}
                    >
                      {activity.category}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{activity.location}</span>
                      {distance && (
                        <span className="text-blue-600 font-medium">
                          {distance.toFixed(1)} mi
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{format(new Date(activity.dateTime), "MMM dd, h:mm a")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span>{activity.currentParticipants || 0}/{activity.maxParticipants}</span>
                      </div>
                    </div>
                  </div>

                  {activity.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                      {activity.description}
                    </p>
                  )}

                  {activity.isPrivate && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      Private Event
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}