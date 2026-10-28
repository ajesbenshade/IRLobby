import ActivityDetailsModal from '@/components/ActivityDetailsModal';
import { DiscoverySkeleton, PageState } from '@/components/AppState';
import FilterModal from '@/components/FilterModal';
import {
  AddToCalendarDialog,
  WhosComingDialog,
  YoureGoingDialog,
  type WhosComingSheetData,
} from '@/components/foyer/FoyerSheets';
import NotificationCenter from '@/components/NotificationCenter';
import DiscoverFeedFilter from '@/components/prayer/DiscoverFeedFilter';
import PrayerCard from '@/components/prayer/PrayerCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { buildActivitySearchParams } from '@/lib/activityFilters';
import { gatheringCalendarUrls, openCalendarUrl } from '@/lib/calendar';
import { audienceChipLabel, type GatheringLike } from '@/lib/foyer';
import { fetchPrayerRequests, passPrayerRequest, prayForRequest } from '@/lib/prayer';
import { apiRequest } from '@/lib/queryClient';
import type { Activity, ActivityFilters } from '@/types/activity';
import { calendarEventSummary } from '@shared/calendarLinks';
import {
  PRAYER_COPY,
  type DiscoverFeedFilter as FeedFilter,
  type PrayerRequest,
} from '@shared/prayer';
import { API_ROUTES, API_ROUTE_BUILDERS, parseActivityListResponse } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { Filter, MapPin, Bell, RefreshCw, WifiOff, Clock, Users } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Discovery() {
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [filters, setFilters] = useState<Partial<ActivityFilters>>({});
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('both');
  const [skippedPrayers, setSkippedPrayers] = useState<string[]>([]);
  const [passedGatherings, setPassedGatherings] = useState<number[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [whosComing, setWhosComing] = useState<WhosComingSheetData | null>(null);
  const [goingActivity, setGoingActivity] = useState<(Activity & GatheringLike) | null>(null);
  const [calendarActivity, setCalendarActivity] = useState<(Activity & GatheringLike) | null>(null);
  const [rsvpPending, setRsvpPending] = useState(false);
  const navigate = useNavigate();
  const [pullDistance, setPullDistance] = useState(0);
  const { token } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const effectiveFilters = filters;

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

  const prayersQuery = useQuery({
    queryKey: ['prayer-requests', 'discover'],
    queryFn: () => fetchPrayerRequests('discover'),
    enabled: !!token && feedFilter !== 'gatherings',
    retry: false,
  });
  const prayers = (prayersQuery.data?.items ?? []).filter(
    (item) => !skippedPrayers.includes(String(item.id)) && !item.viewerIsPraying,
  );
  const showGatherings = feedFilter !== 'prayer';
  const showPrayers = feedFilter !== 'gatherings';
  const discoverTitle = feedFilter === 'prayer' ? PRAYER_COPY.listTitle : 'Discover';

  const skipPrayer = (prayer: PrayerRequest) => {
    setSkippedPrayers((previous) => [...previous, String(prayer.id)]);
    void passPrayerRequest(prayer.id).catch(() => undefined);
  };

  const joinPrayer = async (prayer: PrayerRequest) => {
    await prayForRequest(prayer.id);
    setSkippedPrayers((previous) => [...previous, String(prayer.id)]);
    navigate(`/app/prayer/${prayer.id}/chat`);
  };

  const currentActivity = activities.find((activity) => activity.id === selectedActivityId);

  const advanceAfterRsvp = (activity: Activity & GatheringLike) => {
    setWhosComing(null);
    setGoingActivity(activity);
  };

  const goingDialog = goingActivity ? (
    <YoureGoingDialog
      title={goingActivity.title}
      onPhotos={() => {
        const activityId = goingActivity.id;
        setGoingActivity(null);
        navigate(`/app/activity/${activityId}`);
      }}
      onChat={() => {
        setGoingActivity(null);
        navigate('/app/gatherings');
      }}
      onAddToCalendar={() => setCalendarActivity(goingActivity)}
      onDismiss={() => setGoingActivity(null)}
    />
  ) : null;

  const calendarDialog = calendarActivity ? (
    <AddToCalendarDialog
      summary={calendarEventSummary(calendarActivity.title, calendarActivity.time)}
      onGoogle={() => openCalendarUrl(gatheringCalendarUrls(calendarActivity).google)}
      onOutlook={() => openCalendarUrl(gatheringCalendarUrls(calendarActivity).outlook)}
      onApple={() => openCalendarUrl(gatheringCalendarUrls(calendarActivity).apple)}
      onDismiss={() => setCalendarActivity(null)}
    />
  ) : null;

  const confirmRsvp = async (
    activity: Activity & GatheringLike,
    payload: { include_self: boolean; dependent_ids: number[] },
  ) => {
    setRsvpPending(true);
    try {
      await apiRequest('POST', `/api/activities/${activity.id}/rsvp/`, payload);
      advanceAfterRsvp(activity);
    } finally {
      setRsvpPending(false);
    }
  };

  const handleJoin = async (target?: Activity) => {
    const activity = (target ?? currentActivity) as (Activity & GatheringLike) | undefined;
    if (!activity) return;
    try {
      const response = await apiRequest('GET', `/api/activities/${activity.id}/whos-coming/`);
      const sheet = (await response.json()) as WhosComingSheetData;
      if (!sheet.dependents || sheet.dependents.length === 0) {
        const dependentIds = (sheet.dependents ?? [])
          .filter((child) => child.eligible)
          .map((child) => child.id);
        await confirmRsvp(activity, {
          include_self: sheet.me?.eligible !== false,
          dependent_ids: dependentIds,
        });
        return;
      }
      setWhosComing(sheet);
    } catch {
      try {
        await confirmRsvp(activity, { include_self: true, dependent_ids: [] });
      } catch {
        // RSVP failed; leave the list as-is so the member can retry.
      }
    }
  };

  const handleApplyFilters = (newFilters: ActivityFilters) => {
    setFilters(newFilters);
  };

  // Same as a Foyer left-swipe: hide the card for this visit, and do not record a swipe.
  const passGathering = (activityId: number) => {
    setPassedGatherings((previous) =>
      previous.includes(activityId) ? previous : [...previous, activityId],
    );
  };

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

  const headerActions = (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-11 w-11 p-0"
        onClick={() => setShowFilterModal(true)}
        aria-label="Open discovery filters"
      >
        <Filter className="h-5 w-5 text-muted-foreground" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-11 w-11 p-0"
        onClick={() => void handleRefresh()}
        disabled={isRefreshing}
        aria-label="Refresh activities"
      >
        <RefreshCw
          className={`h-5 w-5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-11 w-11 p-0"
        onClick={() => setShowNotifications(true)}
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
      </Button>
    </div>
  );

  if (isLoading && feedFilter !== 'prayer') {
    return <DiscoverySkeleton />;
  }

  if (error && feedFilter !== 'prayer') {
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
        className="min-h-[100dvh] bg-background"
      />
    );
  }

  const prayerBlock = showPrayers ? (
    <div className="space-y-3 px-4 pb-4">
      {prayers.map((prayer) => (
        <div key={String(prayer.id)} className="space-y-3">
          <button
            type="button"
            className="block w-full text-left"
            onClick={() => navigate(`/app/prayer/${prayer.id}`)}
          >
            <PrayerCard prayer={prayer} />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="h-14 w-[110px] rounded-full border border-[#c8beba] bg-white text-base font-semibold"
              onClick={() => skipPrayer(prayer)}
            >
              {PRAYER_COPY.pass}
            </button>
            <button
              type="button"
              className="h-14 flex-1 rounded-full bg-[#a2033f] text-base font-semibold text-white"
              onClick={() => void joinPrayer(prayer)}
            >
              {PRAYER_COPY.imPraying}
            </button>
          </div>
          <p className="text-center text-sm text-[#6e6a68]">{PRAYER_COPY.buttonHint}</p>
        </div>
      ))}
      {!prayersQuery.isLoading && prayers.length === 0 && feedFilter === 'prayer' ? (
        <p className="pt-8 text-center text-base text-[#6e6a68]">{PRAYER_COPY.emptyDiscover}</p>
      ) : null}
    </div>
  ) : null;

  if (
    noActivities &&
    showGatherings &&
    (!showPrayers || (!prayersQuery.isLoading && prayers.length === 0))
  ) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="bg-card shadow-sm px-4 py-3 flex items-center justify-between">
          <h2 className="font-display text-[28px] font-bold text-foreground">{discoverTitle}</h2>
          {headerActions}
        </header>
        <div className="px-4 pt-3">
          <DiscoverFeedFilter value={feedFilter} onChange={setFeedFilter} />
        </div>
        <PageState
          icon={MapPin}
          title="Nothing coming up"
          description="No upcoming gatherings yet. Refresh, or host one for the church."
          actionLabel="Refresh"
          onAction={() => void handleRefresh()}
          isActionLoading={isRefreshing}
          className="bg-transparent"
        />
        <div className="flex justify-center pb-8">
          <Button asChild variant="outline">
            <Link to="/app/create">Host a gathering</Link>
          </Button>
        </div>
        <FilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApplyFilters={handleApplyFilters}
          currentFilters={filters}
        />
        {goingDialog}
        {calendarDialog}
        <NotificationCenter
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-background min-h-[100dvh] relative overflow-hidden pb-[calc(var(--bottom-nav-offset)+0.5rem)]"
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
      <header className="bg-card shadow-sm px-4 py-3 flex items-center justify-between transition-transform duration-200">
        <h2 className="font-display text-[28px] font-bold text-foreground">{discoverTitle}</h2>
        {headerActions}
      </header>
      <div className="px-4 pt-3">
        <DiscoverFeedFilter value={feedFilter} onChange={setFeedFilter} />
      </div>

      {showGatherings ? (
        <ul className="grid gap-3 p-4 lg:grid-cols-2">
          {activities
            .filter((activity) => !passedGatherings.includes(activity.id))
            .map((activity) => {
              const g = activity as Activity & GatheringLike;
              const when = activity.time ? new Date(activity.time) : null;
              const whenLabel =
                when && !Number.isNaN(when.getTime())
                  ? when.toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : 'Time to be announced';
              return (
                <li key={activity.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => {
                      setSelectedActivityId(activity.id);
                      setShowDetailsModal(true);
                    }}
                  >
                    <h3 className="font-display text-[20px] font-bold text-foreground">
                      {activity.title}
                    </h3>
                    <p className="mt-2 flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-2 h-4 w-4 shrink-0" />
                      {whenLabel}
                    </p>
                    {activity.location ? (
                      <p className="mt-1 flex items-center text-sm text-muted-foreground">
                        <MapPin className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{activity.location}</span>
                      </p>
                    ) : null}
                    <p className="mt-1 flex items-center text-sm text-muted-foreground">
                      <Users className="mr-2 h-4 w-4 shrink-0" />
                      {g.going_count ?? activity.participant_count ?? 0} going
                    </p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="h-14 w-[110px] rounded-full border border-[#c8beba] bg-white text-base font-semibold"
                      onClick={() => passGathering(activity.id)}
                    >
                      Pass
                    </button>
                    <button
                      type="button"
                      className="h-14 flex-1 rounded-full bg-[#a2033f] text-base font-semibold text-white"
                      onClick={() => {
                        setSelectedActivityId(activity.id);
                        void handleJoin(activity);
                      }}
                    >
                      {"I'm coming"}
                    </button>
                  </div>
                </li>
              );
            })}
        </ul>
      ) : null}
      {prayerBlock}

      {/* Modals */}
      {currentActivity && whosComing ? (
        <WhosComingDialog
          activityTitle={currentActivity.title}
          audience={audienceChipLabel(currentActivity as GatheringLike)}
          data={whosComing}
          pending={rsvpPending}
          onClose={() => setWhosComing(null)}
          onConfirm={(payload) =>
            void confirmRsvp(currentActivity as Activity & GatheringLike, payload)
          }
        />
      ) : null}
      {goingDialog}
      {calendarDialog}
      {currentActivity && (
        <>
          <ActivityDetailsModal
            activity={currentActivity}
            isOpen={showDetailsModal}
            onClose={() => setShowDetailsModal(false)}
            onJoin={() => void handleJoin()}
            onAddToCalendar={() => {
              setShowDetailsModal(false);
              setCalendarActivity(currentActivity);
            }}
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
    </div>
  );
}
