import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users, List, Navigation, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface MapViewProps {
  onActivitySelect: (activity: any) => void;
  onToggleView: () => void;
  filters: any;
}

export default function MapView({ onActivitySelect, onToggleView, filters }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

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

  // Get user's current location
  const getCurrentLocation = () => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setIsLoadingLocation(false);
          
          if (googleMapRef.current) {
            googleMapRef.current.setCenter(location);
            googleMapRef.current.setZoom(13);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          setIsLoadingLocation(false);
          // Default to Philadelphia center if location access is denied
          const defaultLocation = { lat: 39.9526, lng: -75.1652 };
          setUserLocation(defaultLocation);
          if (googleMapRef.current) {
            googleMapRef.current.setCenter(defaultLocation);
            googleMapRef.current.setZoom(12);
          }
        }
      );
    } else {
      setIsLoadingLocation(false);
      // Default to Philadelphia center if geolocation is not supported
      const defaultLocation = { lat: 39.9526, lng: -75.1652 };
      setUserLocation(defaultLocation);
      if (googleMapRef.current) {
        googleMapRef.current.setCenter(defaultLocation);
        googleMapRef.current.setZoom(12);
      }
    }
  };

  // Initialize Google Map
  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !window.google) return;

      const defaultCenter = { lat: 39.9526, lng: -75.1652 }; // Philadelphia center
      
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        zoom: 12,
        center: userLocation || defaultCenter,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      });

      // Add user location marker if available
      if (userLocation) {
        new google.maps.Marker({
          position: userLocation,
          map: googleMapRef.current,
          title: "Your Location",
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" fill="#3B82F6" stroke="#FFFFFF" stroke-width="3"/>
                <circle cx="12" cy="12" r="3" fill="#FFFFFF"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12)
          }
        });
      }

      // Add activity markers
      addActivityMarkers();
    };

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      initMap();
    } else {
      // Load Google Maps script - check if already exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGoogleMap`;
        script.async = true;
        script.defer = true;
        
        // Set up global callback
        (window as any).initGoogleMap = initMap;
        
        script.onerror = () => {
          console.error('Failed to load Google Maps API');
        };
        
        document.head.appendChild(script);
      } else {
        // Script already loaded, just init
        setTimeout(initMap, 100);
      }
    }

    // Get user location on mount
    getCurrentLocation();
  }, [userLocation]);

  // Update markers when activities change
  useEffect(() => {
    if (googleMapRef.current) {
      addActivityMarkers();
    }
  }, [filteredActivities]);

  const addActivityMarkers = () => {
    if (!googleMapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers for each activity
    filteredActivities.forEach((activity: any) => {
      if (activity.latitude && activity.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: activity.latitude, lng: activity.longitude },
          map: googleMapRef.current,
          title: activity.title,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 2C11.6 2 8 5.6 8 10c0 6 8 18 8 18s8-12 8-18c0-4.4-3.6-8-8-8z" fill="#EF4444" stroke="#FFFFFF" stroke-width="2"/>
                <circle cx="16" cy="10" r="3" fill="#FFFFFF"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 32)
          }
        });

        // Add click listener to marker
        marker.addListener('click', () => {
          setSelectedActivity(activity);
          onActivitySelect(activity);
        });

        markersRef.current.push(marker);
      }
    });
  };

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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleView}
            className="flex items-center gap-2"
          >
            <List className="h-4 w-4" />
            List View
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={getCurrentLocation}
            disabled={isLoadingLocation}
            className="flex items-center gap-2"
          >
            {isLoadingLocation ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            My Location
          </Button>
        </div>
        
        <div className="text-sm text-gray-600">
          {filteredActivities.length} activities on map
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Activity Details Card */}
        {selectedActivity && (
          <Card className="absolute bottom-4 left-4 right-4 max-w-sm mx-auto shadow-lg">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-sm">{selectedActivity.title}</h3>
                <Badge variant="secondary" className="text-xs">
                  {selectedActivity.category}
                </Badge>
              </div>
              
              <div className="flex items-center text-gray-600 text-xs mb-2">
                <MapPin className="h-3 w-3 mr-1" />
                {selectedActivity.location}
              </div>
              
              <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(selectedActivity.dateTime), 'MMM d, h:mm a')}
                </div>
                <div className="flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  {selectedActivity.currentParticipants || 0}/{selectedActivity.maxParticipants}
                </div>
              </div>
              
              <Button 
                size="sm" 
                className="w-full text-xs"
                onClick={() => onActivitySelect(selectedActivity)}
              >
                View Details
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}