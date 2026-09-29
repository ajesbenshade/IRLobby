import ActivityDetailsModal from '@/components/ActivityDetailsModal';
import FoyerGoingPanel from '@/components/FoyerGoingPanel';
import { DiscoverySkeleton, PageState } from '@/components/AppState';
import FilterModal from '@/components/FilterModal';
import MapView from '@/components/MapView';
import MatchSuccessModal from '@/components/MatchSuccessModal';
import NotificationCenter from '@/components/NotificationCenter';
import SwipeCard from '@/components/SwipeCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { buildActivitySearchParams } from '@/lib/activityFilters';
import { apiRequest } from '@/lib/queryClient';
import type { Activity, ActivityFilters } from '@/types/activity';
import { API_ROUTES, API_ROUTE_BUILDERS, parseActivityListResponse } from '@shared/schema';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Filter, MapPin, Bell, RefreshCw, Map, X, Info, Heart, WifiOff, Sparkles } from 'lucide-react';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface SwipePayload {
  activityId: number;
  swipeType: 'like' | 'pass';
}

interface SwipeMutationResult {
  match?: boolean;
}

export default function Discovery() {
  const navigate = useNavigate();
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showMatchSuccess, setShowMatchSuccess] = useState(false);
  const [matchedActivity, setMatchedActivity] = useState<Activity | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMapView, setShowMapView] = useState(false);
  const [filters, setFilters] = useState<Partial<ActivityFilters>>({});
  const [tonightOnly, setTonightOnly] = useState(true);
  const [vibeReminderDismissed, setVibeReminderDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [goingActivity, setGoingActivity] = useState<Activity | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const vibeSeededRef = useRef(false);

  const vibeDiscoverTags = useMemo(
    () => user?.vibe?.vibeDiscoverTags ?? [],
    [user?.vibe?.vibeDiscoverTags],
  );
  const vibeQuizSkipped = Boolean(user?.vibe?.vibeQuizSkipped);
  const hasVibeProfile = Boolean(user?.vibe?.vibeProfile);

  useEffect(() => {
    if (vibeSeededRef.current) return;
    if (!hasVibeProfile || vibeDiscoverTags.length === 0) return;
    if ((filters.tags?.length ?? 0) > 0) {
      vibeSeededRef.current = true;
      return;
    }
    vibeSeededRef.current = true;
    setFilters((prev) => ({ ...prev, tags: [...vibeDiscoverTags] }));
  }, [hasVibeProfile, vibeDiscoverTags, filters.tags]);

  const tonightWindow = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return { dateFrom: now, dateTo: end };
    // Recompute when Tonight toggles so the 8h window stays fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tonightOnly intentionally refreshes the window
  }, [tonightOnly]);

  const effectiveFilters = useMemo<Partial<ActivityFilters>>(
    () => ({
      ...filters,
      dateFrom: tonightOnly ? tonightWindow.dateFrom : filters.dateFrom,
      dateTo: tonightOnly ? tonightWindow.dateTo : filters.dateTo,
    }),
    [filters, tonightOnly, tonightWindow.dateFrom, tonightWindow.dateTo],
  );

  // Use the token in the API request
  const {
    data: activities = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Activity[]>({
    queryKey: [API_ROUTES.ACTIVITIES, effectiveFilters],
    queryFn: async ({ queryKey }) => {
      const [, activeFilters] = queryKey as [string, Partial<ActivityFilters>];
      const params = buildActivitySearchParams(activeFilters ?? {});
      const endpoint = params
        ? API_ROUTE_BUILDERS.activitiesWithSearch(params)
        : API_ROUTES.ACTIVITIES;

      const response = await apiRequest('GET', endpoint);
      return parseActivityListResponse(await response.json()) as Activity[];
    },
    enabled: !!token, // Only run the query if we have a token
    retry: 1,
  });

  const swipeMutation = useMutation<SwipeMutationResult, Error, SwipePayload>({
    mutationFn: async ({ activityId, swipeType }) => {
      const direction = swipeType === 'like' ? 'right' : 'left';
      const response = await apiRequest('POST', API_ROUTE_BUILDERS.activitySwipe(activityId), {
        direction,
      });
      return (await response.json()) as SwipeMutationResult;
    },
    onSuccess: (data) => {
      if (data?.match) {
        const activity = activities[currentActivityIndex];
        setMatchedActivity(activity);
        setShowMatchSuccess(true);
        queryClient.invalidateQueries({ queryKey: [API_ROUTES.MATCHES] });
      }
      nextActivity();
    },
  });

  const currentActivity = activities[currentActivityIndex];

  const nextActivity = useCallback(() => {
    setCurrentActivityIndex((prev) => prev + 1);
  }, []);

  const handleSwipe = (swipeType: 'like' | 'pass') => {
    if (!currentActivity) return;
    swipeMutation.mutate({
      activityId: currentActivity.id,
      swipeType,
    });
  };

  const handleReject = () => handleSwipe('pass');
  const handleJoin = () => {
    if (!currentActivity) return;
    setGoingActivity(currentActivity);
  };

  const handleApplyFilters = (newFilters: ActivityFilters) => {
    setFilters(newFilters);
    setTonightOnly(false);
    setCurrentActivityIndex(0);
  };

  const deckCleared = activities.length > 0 && currentActivityIndex >= activities.length;
  const noActivities = !isLoading && activities.length === 0;

  // Pull to refresh functionality
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || window.scrollY > 0) return;

    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);

    if (distance > 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance * 0.5, 80)); // Dampen the pull with max distance
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;

    if (pullDistance > 50) {
      // Trigger refresh
      setIsRefreshing(true);
      await refetch();
      setIsRefreshing(false);
    }

    setPullDistance(0);
    isPulling.current = false;
  }, [pullDistance, refetch]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  if (isLoading) {
    return <DiscoverySkeleton />;
  }

  if (error) {
    return (
      <PageState
        icon={WifiOff}
        title="Unable to load activities"
        description={
          error instanceof Error
            ? error.message
            : 'Please try refreshing and check your connection.'
        }
        actionLabel="Retry"
        onAction={() => void handleRefresh()}
        isActionLoading={isRefreshing}
        tone="danger"
        className="min-h-screen bg-background"
      />
    );
  }

  if (noActivities || deckCleared) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card shadow-sm p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Discover Events</h2>
            <p className="text-sm text-muted-foreground">
              {tonightOnly ? 'Tonight (next 8 hours)' : 'Find activities near you'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={tonightOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTonightOnly((prev) => !prev);
                setCurrentActivityIndex(0);
              }}
            >
              Tonight
            </Button>
            <Button variant="ghost" size="sm" className="w-10 h-10 p-0" onClick={() => setShowFilterModal(true)}>
              <Filter className="w-5 h-5" />
            </Button>
          </div>
        </header>
        <PageState
          icon={MapPin}
          title={
            deckCleared
              ? 'You cleared the deck'
              : tonightOnly
                ? 'Quiet night nearby'
                : 'Nothing nearby yet'
          }
          description={
            deckCleared
              ? 'You’ve seen this round. Refresh for anything new, or host a plan so others can find you.'
              : tonightOnly
                ? 'No plans in the next 8 hours. Turn off Tonight, widen your radius, or host something yourself.'
                : 'Widen the radius, clear a few filters, or be the one who starts tonight’s plan.'
          }
          actionLabel={deckCleared ? 'Reload deck' : tonightOnly ? 'Show all times' : 'Refresh'}
          onAction={() => {
            if (deckCleared) {
              setCurrentActivityIndex(0);
              void handleRefresh();
              return;
            }
            if (tonightOnly) {
              setTonightOnly(false);
              setCurrentActivityIndex(0);
              return;
            }
            void handleRefresh();
          }}
          isActionLoading={isRefreshing}
          className="bg-transparent"
        />
        <div className="flex justify-center pb-8">
          <Button asChild variant="outline">
            <Link to="/app/create">Host a plan</Link>
          </Button>
        </div>
        <FilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApplyFilters={handleApplyFilters}
          currentFilters={filters}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-background min-h-screen relative overflow-hidden pb-[calc(var(--bottom-nav-offset)+0.5rem)]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-card shadow-sm transition-transform duration-200">
          <div className="flex items-center justify-center py-4">
            <RefreshCw
              className={`w-6 h-6 text-primary transition-transform duration-200 ${
                pullDistance > 50 ? 'rotate-180' : ''
              } ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span className="ml-2 text-sm text-muted-foreground">
              {pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Header with refresh indicator */}
      <header className="bg-card shadow-sm p-4 flex items-center justify-between transition-transform duration-200">
        <div>
          <h2 className="text-xl font-bold text-foreground">Discover Events</h2>
          <p className="text-sm text-muted-foreground">
            {tonightOnly ? 'Tonight (next 8 hours)' : 'Find activities near you'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={tonightOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setTonightOnly((prev) => !prev);
              setCurrentActivityIndex(0);
            }}
          >
            Tonight
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 p-0 relative"
            onClick={() => setShowNotifications(true)}
            aria-label="Open notifications"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 p-0"
            onClick={() => setShowMapView(true)}
            aria-label="Open map view"
          >
            <Map className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 p-0"
            onClick={() => setShowFilterModal(true)}
            aria-label="Open discovery filters"
          >
            <Filter className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh activities"
          >
            <RefreshCw className={`w-5 h-5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {vibeQuizSkipped && !hasVibeProfile && !vibeReminderDismissed ? (
        <div className="mx-4 mt-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div className="flex-1 space-y-2">
              <p className="font-medium text-foreground">
                Want a feed that actually fits?
              </p>
              <p className="text-sm text-muted-foreground">
                Take the 60-second vibe quiz and we&apos;ll spotlight the hangs that match your energy.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => setVibeReminderDismissed(true)}>
                  Not now
                </Button>
                <Button asChild size="sm">
                  <Link to="/app/vibe-quiz">Take the quiz</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Swipe Cards Container */}
      <div className="relative p-4 md:p-6 lg:p-8 h-full">
        {/* Background cards for stacking effect */}
        {activities
          .slice(currentActivityIndex + 1, currentActivityIndex + 3)
          .map((activity, index) => (
            <Card
              key={activity.id}
              className={`absolute inset-x-4 bg-white rounded-2xl shadow-lg transform ${
                index === 0 ? 'scale-97 opacity-80 z-20' : 'scale-95 opacity-60 z-10'
              } ${index === 0 ? 'top-4' : 'top-6'}`}
            >
              <CardContent className="p-0">
                <div className="w-full h-48 bg-muted rounded-t-2xl"></div>
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
            disabled={swipeMutation.isPending}
          />
        )}

        {/* Action buttons - Fixed position to avoid cutoff */}
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-offset)+0.75rem)] flex items-center justify-center gap-6 z-50 px-4">
          <Button
            variant="outline"
            size="lg"
            onClick={handleReject}
            disabled={swipeMutation.isPending}
            className="w-16 h-16 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-50 shadow-lg bg-white"
            aria-label="Pass on this activity"
          >
            <X className="h-6 w-6" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetailsModal(true)}
            className="w-12 h-12 rounded-full border-2 border-border text-muted-foreground hover:bg-muted shadow-lg bg-card"
            aria-label="View activity details"
          >
            <Info className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleJoin}
            disabled={swipeMutation.isPending}
            className="w-16 h-16 rounded-full border-2 border-green-500 text-green-500 hover:bg-green-50 shadow-lg bg-white"
            aria-label="Join this activity"
          >
            <Heart className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {goingActivity ? (
        <FoyerGoingPanel
          activity={goingActivity}
          onClose={() => setGoingActivity(null)}
          onDone={() => {
            setGoingActivity(null);
            nextActivity();
            navigate('/app/matches');
          }}
        />
      ) : null}

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
      <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

      {/* Map View Modal */}
      {showMapView && (
        <div className="fixed inset-0 z-50 bg-white">
          <MapView
            onActivitySelect={(activity) => {
              setCurrentActivityIndex(
                activities.findIndex((candidate) => candidate.id === activity.id),
              );
              setShowMapView(false);
              setShowDetailsModal(true);
            }}
            onToggleView={() => setShowMapView(false)}
            filters={effectiveFilters}
          />
        </div>
      )}
    </div>
  );
}
