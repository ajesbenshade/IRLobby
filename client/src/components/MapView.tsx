import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MapPin, Navigation, Calendar, Users, List } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import type { Activity } from '../../../shared/client-types';

interface ActivityFilters {
  category: string;
  maxDistance: number[];
  priceRange: number[];
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  skillLevel: string;
  ageRestriction: string;
  tags: string[];
  location: string;
}

interface MapViewProps {
  onActivitySelect: (activity: Activity) => void;
  onToggleView: () => void;
  filters: ActivityFilters;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

export default function MapView({ onActivitySelect, onToggleView, filters }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState('25');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: [
      '/api/activities',
      userLocation?.latitude,
      userLocation?.longitude,
      searchRadius,
      filters,
    ],
    queryFn: async () => {
      if (!userLocation) return [];

      const params = new URLSearchParams({
        latitude: userLocation.latitude.toString(),
        longitude: userLocation.longitude.toString(),
        radius: searchRadius,
        ...Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, String(value)])),
      });

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/activities/?${params}`,
      );
      if (!response.ok) throw new Error('Failed to fetch activities');
      return response.json();
    },
    enabled: !!userLocation,
    retry: 1,
  });

  useEffect(() => {
    requestLocation();
    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && activities.length > 0) {
      updateMapMarkers();
    }
  }, [activities]);

  const loadGoogleMaps = () => {
    if (window.google) {
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyDptAUAkTz9QEq1fOODRWHFrLD7-we5Crw&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = initializeMap;
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current || !userLocation) return;

    const google = window.google;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: userLocation.latitude, lng: userLocation.longitude },
      zoom: 12,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    mapInstanceRef.current = map;

    // Add user location marker
    new google.maps.Marker({
      position: { lat: userLocation.latitude, lng: userLocation.longitude },
      map: map,
      title: 'Your Location',
      icon: {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%234285F4'%3E%3Ccircle cx='12' cy='12' r='8'/%3E%3Ccircle cx='12' cy='12' r='3' fill='white'/%3E%3C/svg%3E",
        scaledSize: new google.maps.Size(24, 24),
      },
    });

    updateMapMarkers();
  };

  const updateMapMarkers = () => {
    if (!mapInstanceRef.current) return;

    const google = window.google;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Add activity markers
    activities.forEach((activity: Activity) => {
      if (activity.latitude && activity.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: activity.latitude, lng: activity.longitude },
          map: mapInstanceRef.current,
          title: activity.title,
          icon: {
            url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23E11D48'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E",
            scaledSize: new google.maps.Size(32, 32),
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; max-width: 250px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold;">${activity.title}</h3>
              <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${activity.location}</p>
              <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${activity.time ? format(new Date(activity.time), 'MMM d, yyyy • h:mm a') : 'Time TBD'}</p>
              <div style="display: flex; gap: 8px; align-items: center;">
                <span style="background: #EF4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${activity.tags && activity.tags.length > 0 ? activity.tags[0] : 'Activity'}</span>
              </div>
            </div>
          `,
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current, marker);
        });

        markersRef.current.push(marker);
      }
    });
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
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
            setLocationError(
              'Location access denied. Please enable location permissions to find nearby activities.',
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out.');
            break;
          default:
            setLocationError('An unknown error occurred while retrieving location.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      },
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Sports & Fitness': 'bg-red-100 text-red-700',
      'Food & Drinks': 'bg-orange-100 text-orange-700',
      'Outdoor Adventures': 'bg-green-100 text-green-700',
      'Arts & Culture': 'bg-purple-100 text-purple-700',
      Nightlife: 'bg-pink-100 text-pink-700',
      Learning: 'bg-blue-100 text-blue-700',
      Technology: 'bg-gray-100 text-gray-700',
      Music: 'bg-indigo-100 text-indigo-700',
      Social: 'bg-yellow-100 text-yellow-700',
      Gaming: 'bg-cyan-100 text-cyan-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
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
      <div className="bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Map View</h2>
            <p className="text-sm text-gray-500">
              {activities.length} activities within {searchRadius} miles
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onToggleView}>
            <List className="w-4 h-4 mr-1" />
            List View
          </Button>
        </div>

        {/* Radius Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Search Radius:</span>
          <Select value={searchRadius} onValueChange={setSearchRadius}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 miles</SelectItem>
              <SelectItem value="10">10 miles</SelectItem>
              <SelectItem value="25">25 miles</SelectItem>
              <SelectItem value="50">50 miles</SelectItem>
              <SelectItem value="100">100 miles</SelectItem>
              <SelectItem value="200">200 miles</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Interactive Google Map */}
      <div className="relative h-96">
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: '400px' }} />

        {/* Your Location Indicator */}
        {userLocation && (
          <div className="absolute top-4 left-4 bg-white shadow-md rounded-lg px-3 py-2 flex items-center gap-2 z-10">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-700">Your Location</span>
          </div>
        )}
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
          activities.map((activity: Activity) => {
            const distance =
              userLocation && activity.latitude && activity.longitude
                ? calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    activity.latitude,
                    activity.longitude,
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
                    <h3 className="font-semibold text-lg truncate flex-1 pr-2">{activity.title}</h3>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getCategoryColor(activity.tags && activity.tags.length > 0 ? activity.tags[0] : 'Activity')}`}
                    >
                      {activity.tags && activity.tags.length > 0 ? activity.tags[0] : 'Activity'}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{activity.location}</span>
                      {distance && (
                        <span className="text-blue-600 font-medium">{distance.toFixed(1)} mi</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>
                          {activity.time
                            ? format(new Date(activity.time), 'MMM dd, yyyy • h:mm a')
                            : 'Time TBD'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span>
                          {activity.participant_count || 0}/{activity.capacity}
                        </span>
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
