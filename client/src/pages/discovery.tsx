import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SwipeCard from "@/components/SwipeCard";
import ActivityDetailsModal from "@/components/ActivityDetailsModal";
import MatchSuccessModal from "@/components/MatchSuccessModal";
import FilterModal from "@/components/FilterModal";
import NotificationCenter from "@/components/NotificationCenter";
import MapView from "@/components/MapView";
import { Filter, MapPin, Bell, RefreshCw, Map } from "lucide-react";
import type { Activity } from "@shared/schema";

export default function Discovery() {
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMatchSuccess, setShowMatchSuccess] = useState(false);
  const [matchedActivity, setMatchedActivity] = useState<Activity | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMapView, setShowMapView] = useState(false);
  const [filters, setFilters] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['/api/activities/discover', filters],
    retry: 1,
  });

  const { data: unreadNotifications = 0 } = useQuery({
    queryKey: ['/api/notifications/unread-count'],
    retry: 1,
  });

  const swipeMutation = useMutation({
    mutationFn: async ({ activityId, swipeType }: { activityId: number; swipeType: 'like' | 'pass' }) => {
      const response = await apiRequest('POST', `/api/activities/${activityId}/swipe`, { swipeType });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.match) {
        const activity = activities[currentActivityIndex];
        setMatchedActivity(activity);
        setShowMatchSuccess(true);
        queryClient.invalidateQueries({ queryKey: ['/api/matches'] });
      }
      nextActivity();
    },
  });

  const currentActivity = activities[currentActivityIndex];

  const nextActivity = useCallback(() => {
    setCurrentActivityIndex(prev => prev + 1);
  }, []);

  const handleSwipe = (swipeType: 'like' | 'pass') => {
    if (!currentActivity) return;
    swipeMutation.mutate({
      activityId: currentActivity.id,
      swipeType,
    });
  };

  const handleReject = () => handleSwipe('pass');
  const handleJoin = () => handleSwipe('like');

  const handleApplyFilters = (newFilters: any) => {
    setFilters(newFilters);
    setCurrentActivityIndex(0);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['/api/activities/discover'] });
    setCurrentActivityIndex(0);
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!activities.length || currentActivityIndex >= activities.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <MapPin className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">No more activities</h2>
        <p className="text-gray-600 mb-6">Check back later for new events in your area!</p>
        <Button 
          onClick={() => window.location.reload()} 
          className="bg-primary text-white"
        >
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 pb-20 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Discover Events</h2>
          <p className="text-sm text-gray-500">Find activities near you</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-10 h-10 p-0 relative"
            onClick={() => setShowNotifications(true)}
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-10 h-10 p-0"
            onClick={() => setShowMapView(true)}
          >
            <Map className="w-5 h-5 text-gray-600" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-10 h-10 p-0"
            onClick={() => setShowFilterModal(true)}
          >
            <Filter className="w-5 h-5 text-gray-600" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-10 h-10 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Swipe Cards Container */}
      <div className="relative p-4 h-full">
        {/* Background cards for stacking effect */}
        {activities.slice(currentActivityIndex + 1, currentActivityIndex + 3).map((activity, index) => (
          <Card 
            key={activity.id}
            className={`absolute inset-x-4 top-4 bg-white rounded-2xl shadow-lg transform ${
              index === 0 ? 'scale-97 opacity-80 z-20' : 'scale-95 opacity-60 z-10'
            }`}
            style={{ top: `${16 + index * 8}px` }}
          >
            <CardContent className="p-0">
              <div className="w-full h-48 bg-gray-200 rounded-t-2xl"></div>
            </CardContent>
          </Card>
        ))}

        {/* Active card */}
        {currentActivity && (
          <SwipeCard
            activity={currentActivity}
            onSwipeLeft={handleReject}
            onSwipeRight={handleJoin}
            onShowDetails={() => setShowDetailsModal(true)}
            className="absolute inset-x-4 top-0 z-30"
          />
        )}

        {/* Action buttons - Fixed position to avoid cutoff */}
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 flex items-center space-x-6 z-50">
          <Button
            variant="outline"
            size="lg"
            onClick={handleReject}
            disabled={swipeMutation.isPending}
            className="w-16 h-16 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-50 shadow-lg bg-white"
          >
            <span className="text-2xl">✕</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetailsModal(true)}
            className="w-12 h-12 rounded-full border-2 border-gray-300 text-gray-600 hover:bg-gray-50 shadow-lg bg-white"
          >
            <span className="text-lg">ℹ</span>
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            onClick={handleJoin}
            disabled={swipeMutation.isPending}
            className="w-16 h-16 rounded-full border-2 border-green-500 text-green-500 hover:bg-green-50 shadow-lg bg-white"
          >
            <span className="text-2xl">♥</span>
          </Button>
        </div>
      </div>

      {/* Modals */}
      {currentActivity && (
        <>
          <ActivityDetailsModal
            activity={currentActivity}
            isOpen={showDetailsModal}
            onClose={() => setShowDetailsModal(false)}
            onJoin={handleJoin}
          />
          
          <MatchSuccessModal
            activity={matchedActivity}
            isOpen={showMatchSuccess}
            onClose={() => setShowMatchSuccess(false)}
          />
        </>
      )}

      {/* Filter Modal */}
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApplyFilters={handleApplyFilters}
        currentFilters={filters}
      />

      {/* Notification Center */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Map View Modal */}
      {showMapView && (
        <div className="fixed inset-0 z-50 bg-white">
          <MapView
            onActivitySelect={(activity) => {
              setCurrentActivityIndex(activities.findIndex((a: any) => a.id === activity.id));
              setShowMapView(false);
              setShowDetailsModal(true);
            }}
            onToggleView={() => setShowMapView(false)}
            filters={filters}
          />
        </div>
      )}
    </div>
  );
}
