import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Image, PanResponder, StyleSheet } from 'react-native';
import { Modal, Portal, Snackbar, Text } from 'react-native-paper';

import {
  AccentPill,
  AppScrollView,
  EmptyStatePanel,
  PageHeader,
  PanelCard,
} from '@components/AppChrome';
import { FoyerHeader } from '@components/FoyerHeader';
import { GiveSheet } from '@components/GiveSheet';
import { WhosComingSheet } from '@components/WhosComingSheet';
import { SafetyActionsModal } from '@components/SafetyActionsModal';
import { safeImpactHaptic, safeNotificationHaptic } from '@lib/haptics';
import MapView, { Marker } from '@components/MapViewCompat';
import { MatchCelebration } from '@components/MatchCelebration';
import { ActivityCardSkeleton } from '@components/skeletons';
import { RefreshControl, ScrollView, View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { Chip } from '@components/ui/Chip';
import { Field } from '@components/ui/Field';
import { isFoyerMode, isTicketingUiEnabled } from '@constants/appMode';
import {
  audienceChipLabel,
  buildRsvpPayload,
  coverPhotoUrl,
  defaultRsvpSelection,
  giftDisclaimer,
  giftIntro,
  goingCountLabel,
  hostAvatarUrl,
  hostDisplayName,
  shouldSkipWhosComingSheet,
  type WhosComingResponse,
} from '@foyer/logic';
import { config } from '@constants/config';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList, MainTabParamList } from '@navigation/types';
import {
  fetchActivities,
  joinActivity,
  leaveActivity,
  swipeActivity,
  type ActivityFetchFilters,
} from '@services/activityService';
import { fetchWhosComing, postGivingLink, postRsvp } from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';
import type { Activity } from '../../types/activity';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const AnimatedView = Animated.View as unknown as ComponentType<any>;

type DiscoverNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Discover'>,
  NativeStackNavigationProp<MainStackParamList>
>;

const isActivityTicketed = (activity: {
  isTicketed?: boolean;
  is_ticketed?: boolean;
}) => Boolean(activity.isTicketed || activity.is_ticketed);

const activityTicketPrice = (activity: {
  ticketPrice?: number | string | null;
  ticket_price?: number | string | null;
}) => {
  const raw = activity.ticketPrice ?? activity.ticket_price;
  const value = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
};

const formatActivityTime = (value?: string) => {
  if (!value) {
    return 'Time TBD';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Time TBD';
  }
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const DiscoverScreen = () => {
  const navigation = useNavigation<DiscoverNavigationProp>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const pan = useRef(new Animated.ValueXY()).current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchMessage, setMatchMessage] = useState<string | null>(null);
  const [matchContext, setMatchContext] = useState<{ name?: string; title?: string } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [safetyUserId, setSafetyUserId] = useState<number | string | null>(null);
  const [safetyUserLabel, setSafetyUserLabel] = useState<string | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [distanceFilter, setDistanceFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [tonightOnly, setTonightOnly] = useState(true);
  const [whosComing, setWhosComing] = useState<WhosComingResponse | null>(null);
  const [giveTarget, setGiveTarget] = useState<Activity | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [rsvpPending, setRsvpPending] = useState(false);

  const normalizeDateFilter = useCallback((value: string, endOfDay: boolean) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed}T${endOfDay ? '23:59:59' : '00:00:00'}Z`;
    }

    return trimmed;
  }, []);

  const tonightWindow = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return {
      date_from: now.toISOString(),
      date_to: end.toISOString(),
    };
  }, [tonightOnly]);

  const discoverFilters: ActivityFetchFilters = useMemo(
    () => ({
      category: categoryFilter.trim() || undefined,
      location: locationFilter.trim() || undefined,
      tags: (() => {
        const normalizedTags = tagFilter
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        return normalizedTags.length ? normalizedTags : undefined;
      })(),
      radius: distanceFilter.trim() ? Number(distanceFilter) : undefined,
      skill_level: skillFilter.trim() || undefined,
      age_restriction: ageFilter.trim() || undefined,
      visibility: visibilityFilter.trim() || undefined,
      date_from: tonightOnly
        ? tonightWindow.date_from
        : normalizeDateFilter(dateFromFilter, false),
      date_to: tonightOnly ? tonightWindow.date_to : normalizeDateFilter(dateToFilter, true),
    }),
    [
      ageFilter,
      categoryFilter,
      dateFromFilter,
      dateToFilter,
      distanceFilter,
      locationFilter,
      normalizeDateFilter,
      skillFilter,
      tagFilter,
      tonightOnly,
      tonightWindow.date_from,
      tonightWindow.date_to,
      visibilityFilter,
    ],
  );

  const {
    data: activities = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['mobile-discover-activities', discoverFilters],
    queryFn: () => fetchActivities(discoverFilters),
    // Paid events can't be joined for free, so hide them while ticket sales are off.
    select: (items) =>
      isTicketingUiEnabled(config.ticketingEnabled)
        ? items
        : items.filter((item) => !isActivityTicketed(item)),
  });

  const swipeMutation = useMutation({
    mutationFn: ({ activityId, direction }: { activityId: number | string; direction: 'left' | 'right' }) =>
      swipeActivity(activityId, direction),
    onSuccess: async (data, variables) => {
      if (variables.direction === 'right' && data.matched) {
        void safeNotificationHaptic('success');
        const matchedActivity = activities[currentIndex];
        const hostName =
          matchedActivity == null
            ? undefined
            : typeof matchedActivity.host === 'string'
              ? matchedActivity.host
              : [matchedActivity.host.firstName, matchedActivity.host.lastName]
                  .filter(Boolean)
                  .join(' ') || matchedActivity.host.email || undefined;
        setMatchContext({ name: hostName, title: matchedActivity?.title });
        setMatchMessage("It's a match!");
      } else {
        setMatchMessage(null);
        setMatchContext(null);
      }

      setCurrentIndex((previous) => previous + 1);

      await queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-matches'] });
      if (data.conversationId != null) {
        await queryClient.invalidateQueries({ queryKey: ['mobile-conversations'] });
      }
    },
  });

  const participationMutation = useMutation({
    mutationFn: ({ activityId, action }: { activityId: number | string; action: 'join' | 'leave' }) =>
      action === 'join' ? joinActivity(activityId) : leaveActivity(activityId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-hosted-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-matches'] });
    },
  });

  const currentActivity = activities[currentIndex];
  const isBusy = swipeMutation.isPending || participationMutation.isPending;
  const activeFilterCount = useMemo(
    () =>
      [
        categoryFilter,
        locationFilter,
        tagFilter,
        distanceFilter,
        skillFilter,
        ageFilter,
        visibilityFilter,
        tonightOnly ? 'tonight' : '',
        tonightOnly ? '' : dateFromFilter,
        tonightOnly ? '' : dateToFilter,
      ].filter((value) => value.trim().length > 0).length,
    [
      ageFilter,
      categoryFilter,
      dateFromFilter,
      dateToFilter,
      distanceFilter,
      locationFilter,
      skillFilter,
      tagFilter,
      tonightOnly,
      visibilityFilter,
    ],
  );

  const animateSwipe = useCallback(
    (direction: 'left' | 'right', onComplete: () => void) => {
      Animated.timing(pan, {
        toValue: { x: direction === 'right' ? 400 : -400, y: 0 },
        duration: 180,
        useNativeDriver: false,
      }).start(() => {
        pan.setValue({ x: 0, y: 0 });
        onComplete();
      });
    },
    [pan],
  );

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (!currentActivity || isBusy) {
        return;
      }

      void safeImpactHaptic(direction === 'right' ? 'medium' : 'light');

      animateSwipe(direction, () => {
        swipeMutation.mutate({
          activityId: currentActivity.id,
          direction,
        });
      });
    },
    [animateSwipe, currentActivity, isBusy, swipeMutation],
  );

  const advanceAfterRsvp = useCallback((activity: Activity) => {
    setWhosComing(null);
    setCurrentIndex((index) => index + 1);
    if (activity.giving_available) {
      setGiveTarget(activity);
    }
  }, []);

  const confirmRsvp = useCallback(
    async (activity: Activity, payload: { include_self: boolean; dependent_ids: number[] }) => {
      setRsvpPending(true);
      setRsvpError(null);
      try {
        await postRsvp(activity.id, payload);
        advanceAfterRsvp(activity);
      } catch (error) {
        setRsvpError(getErrorMessage(error, 'Unable to save your RSVP.'));
      } finally {
        setRsvpPending(false);
      }
    },
    [advanceAfterRsvp],
  );

  const startGoing = useCallback(async () => {
    if (!currentActivity || isBusy || rsvpPending) {
      return;
    }
    if (!isFoyerMode()) {
      handleSwipe('right');
      return;
    }
    setRsvpPending(true);
    setRsvpError(null);
    try {
      const sheet = await fetchWhosComing(currentActivity.id);
      if (shouldSkipWhosComingSheet(sheet)) {
        const selection = defaultRsvpSelection(sheet);
        await postRsvp(currentActivity.id, buildRsvpPayload(selection.includeSelf, selection.dependentIds));
        advanceAfterRsvp(currentActivity);
        return;
      }
      setWhosComing(sheet);
    } catch (error) {
      setRsvpError(getErrorMessage(error, 'Unable to open the RSVP list.'));
    } finally {
      setRsvpPending(false);
    }
  }, [advanceAfterRsvp, currentActivity, handleSwipe, isBusy, rsvpPending]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !isBusy && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          pan.setValue({ x: gestureState.dx, y: 0 });
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 80) {
            if (isFoyerMode()) {
              void startGoing();
              Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                useNativeDriver: false,
              }).start();
              return;
            }
            handleSwipe('right');
            return;
          }

          if (gestureState.dx < -80) {
            handleSwipe('left');
            return;
          }

          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        },
      }),
    [handleSwipe, isBusy, pan, startGoing],
  );

  const resetDeck = useCallback(() => {
    setCurrentIndex(0);
    setMatchMessage(null);
    setMatchContext(null);
    void refetch();
  }, [refetch]);

  const resetFilters = useCallback(() => {
    setCategoryFilter('');
    setLocationFilter('');
    setTagFilter('');
    setDistanceFilter('');
    setSkillFilter('');
    setAgeFilter('');
    setVisibilityFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setTonightOnly(true);
    setCurrentIndex(0);
  }, []);

  // Vibe quiz integration -----------------------------------------------------
  // Seed the tag filter from the user's vibe profile on first mount so the deck
  // is personalized immediately. We only do this once per session and only when
  // the user has not already typed something into the filter themselves.
  const vibeDiscoverTags = user?.vibe?.vibeDiscoverTags ?? [];
  const vibeQuizSkipped = Boolean(user?.vibe?.vibeQuizSkipped);
  const hasVibeProfile = Boolean(user?.vibe?.vibeProfile);
  const vibeSeededRef = useRef(false);
  const [vibeToastVisible, setVibeToastVisible] = useState(false);
  const [vibeReminderDismissed, setVibeReminderDismissed] = useState(false);

  useEffect(() => {
    if (vibeSeededRef.current) {
      return;
    }
    if (!hasVibeProfile || vibeDiscoverTags.length === 0) {
      return;
    }
    if (tagFilter.trim().length > 0) {
      vibeSeededRef.current = true;
      return;
    }
    vibeSeededRef.current = true;
    setTagFilter(vibeDiscoverTags.join(', '));
    setVibeToastVisible(true);
  }, [hasVibeProfile, vibeDiscoverTags, tagFilter]);

  const cardStyle = {
    transform: [
      { translateX: pan.x },
      {
        rotate: pan.x.interpolate({
          inputRange: [-240, 0, 240],
          outputRange: ['-10deg', '0deg', '10deg'],
        }),
      },
    ],
  };

  const currentTag = currentActivity?.tags?.[0] || currentActivity?.category || 'Activity';
  const currentHostName =
    currentActivity == null
      ? 'Community host'
      : typeof currentActivity.host === 'string'
        ? currentActivity.host
        : [currentActivity.host.firstName, currentActivity.host.lastName].filter(Boolean).join(' ') ||
          currentActivity.host.email ||
          'Community host';
  const currentTimeLabel = formatActivityTime(currentActivity?.time);
  const showTickets = isTicketingUiEnabled(config.ticketingEnabled);
  const ticketed = showTickets && currentActivity ? isActivityTicketed(currentActivity) : false;
  const ticketPrice = currentActivity ? activityTicketPrice(currentActivity) : null;
  const foyerMode = isFoyerMode();
  const coverImage = currentActivity ? coverPhotoUrl(currentActivity) ?? currentActivity.images?.[0] : undefined;
  const audienceLabel = currentActivity ? audienceChipLabel(currentActivity) : '';
  const goingLabel = currentActivity
    ? goingCountLabel(currentActivity.going_count ?? currentActivity.participant_count ?? 0)
    : '';
  const foyerHostName = currentActivity ? hostDisplayName(currentActivity) : '';
  const foyerHostAvatar = currentActivity ? hostAvatarUrl(currentActivity) : null;

  return (
    <>
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <FoyerHeader />
      <PageHeader
        eyebrow="Discover"
        title="Gatherings near you"
        subtitle="Swipe to pass, or say you’re going."
        rightContent={
          <AppButton compact variant="ghost" onPress={() => navigation.navigate('Notifications')}>
            Pings
          </AppButton>
        }
      />

      {vibeQuizSkipped && !hasVibeProfile && !vibeReminderDismissed ? (
        <PanelCard style={styles.vibeReminderCard}>
          <Text variant="titleMedium" style={styles.vibeReminderTitle}>
            Want a feed that actually fits?
          </Text>
          <Text style={styles.vibeReminderSubtitle}>
            Take the 60-second vibe quiz and we&apos;ll spotlight the hangs that match your energy.
          </Text>
          <View style={styles.vibeReminderActions}>
            <AppButton compact variant="ghost" onPress={() => setVibeReminderDismissed(true)}>
              Not now
            </AppButton>
            <AppButton compact onPress={() => navigation.navigate('VibeQuizModal')}>
              Take the quiz
            </AppButton>
          </View>
        </PanelCard>
      ) : null}

      <View style={styles.toolbar}>
            <Chip
              label={showFilters ? 'Hide filters' : `Filters${activeFilterCount ? ` · ${activeFilterCount}` : ''}`}
              selected={showFilters}
              onPress={() => setShowFilters((previous) => !previous)}
            />
            <Chip
              label={showMap ? 'Hide map' : 'Map'}
              selected={showMap}
              onPress={() => setShowMap((previous) => !previous)}
            />
            <Chip
              label="Tonight"
              selected={tonightOnly}
              onPress={() => {
                setTonightOnly((previous) => !previous);
                setCurrentIndex(0);
              }}
            />
            <AccentPill tone="neutral">{activities.length} nearby</AccentPill>
          </View>

          {showFilters ? (
            <PanelCard style={styles.filterCard}>
              <View style={styles.filterHeader}>
                <View style={styles.filterHeaderCopy}>
                  <Text variant="titleMedium" style={styles.filterTitle}>
                    Tune the deck
                  </Text>
                  <Text style={styles.filterSubtitle}>Keep it simple. The feed should stay scannable.</Text>
                </View>
                <AppButton compact variant="ghost" onPress={resetFilters}>
                  Clear
                </AppButton>
              </View>
              <View style={styles.chipRow}>
                {[
                  { label: 'Nearby', value: '5' },
                  { label: '10 km', value: '10' },
                  { label: '25 km', value: '25' },
                ].map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={distanceFilter === option.value}
                    onPress={() => {
                      setDistanceFilter((current) =>
                        current === option.value ? '' : option.value,
                      );
                      setCurrentIndex(0);
                    }}
                  />
                ))}
              </View>
              <View style={styles.chipRow}>
                {[
                  { label: 'Everyone', value: 'everyone' },
                  { label: 'Friends', value: 'friends' },
                ].map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={visibilityFilter === option.value}
                    onPress={() => {
                      setVisibilityFilter((current) =>
                        current === option.value ? '' : option.value,
                      );
                      setCurrentIndex(0);
                    }}
                  />
                ))}
              </View>
              <Field
                label="Category"
                value={categoryFilter}
                onChangeText={setCategoryFilter}
                placeholder="Music, food, outdoors…"
              />
              <Field
                label="Neighborhood"
                value={locationFilter}
                onChangeText={setLocationFilter}
                placeholder="City or area"
              />
              <Field
                label="Tags"
                value={tagFilter}
                onChangeText={setTagFilter}
                placeholder="Low-key, rooftop, hike"
              />
              {!tonightOnly ? (
                <>
                  <Field
                    label="Starts after"
                    value={dateFromFilter}
                    onChangeText={setDateFromFilter}
                    placeholder="e.g. 2026-08-14"
                  />
                  <Field
                    label="Ends before"
                    value={dateToFilter}
                    onChangeText={setDateToFilter}
                    placeholder="e.g. 2026-08-16"
                  />
                </>
              ) : null}
            </PanelCard>
          ) : null}

          {showMap && activities.length > 0 ? (
            <PanelCard style={styles.mapCard}>
              <Text variant="titleMedium" style={styles.mapTitle}>
                Nearby right now
              </Text>
              <Text style={styles.mapSubtitle}>Tap a pin to jump straight into that plan.</Text>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: Number(activities[0].latitude ?? 37.7749),
                  longitude: Number(activities[0].longitude ?? -122.4194),
                  latitudeDelta: 0.12,
                  longitudeDelta: 0.12,
                }}
              >
                {activities
                  .filter((item) => item.latitude != null && item.longitude != null)
                  .map((activity) => (
                    <Marker
                      key={String(activity.id)}
                      coordinate={{
                        latitude: Number(activity.latitude),
                        longitude: Number(activity.longitude),
                      }}
                      title={activity.title}
                      description={activity.location ?? undefined}
                      onPress={() => {
                        const targetIndex = activities.findIndex((entry) => entry.id === activity.id);
                        if (targetIndex >= 0) {
                          setCurrentIndex(targetIndex);
                          setShowDetails(true);
                        }
                      }}
                    />
                  ))}
              </MapView>
            </PanelCard>
          ) : null}

          {isLoading ? <ActivityCardSkeleton /> : null}

          {error || swipeMutation.error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {getErrorMessage(error ?? swipeMutation.error, 'Unable to load activities.')}
              </Text>
              <AppButton variant="outline" onPress={() => void refetch()} disabled={isRefetching}>
                {isRefetching ? 'Retrying...' : 'Retry'}
              </AppButton>
            </View>
          ) : null}

          {participationMutation.error ? (
            <Text style={styles.errorText}>
              {getErrorMessage(participationMutation.error, 'Unable to update participation.')}
            </Text>
          ) : null}

          {!isLoading && !error && activities.length === 0 ? (
            <EmptyStatePanel
              title={tonightOnly ? 'Quiet night nearby' : 'Nothing nearby yet'}
              description={
                tonightOnly
                  ? 'No plans in the next 8 hours. Turn off Tonight, widen your radius, or host something yourself.'
                  : 'Widen the radius, clear a few filters, or be the one who starts tonight’s plan.'
              }
              action={
                <View style={styles.emptyActions}>
                  {tonightOnly ? (
                    <AppButton
                      onPress={() => {
                        setTonightOnly(false);
                        setCurrentIndex(0);
                      }}
                    >
                      Show all times
                    </AppButton>
                  ) : null}
                  <AppButton variant="outline" onPress={resetDeck}>
                    Refresh deck
                  </AppButton>
                  <AppButton variant="ghost" onPress={() => navigation.navigate('Create')}>
                    Host a plan
                  </AppButton>
                </View>
              }
            />
          ) : null}

          {!isLoading && activities.length > 0 && !currentActivity ? (
            <EmptyStatePanel
              title="You cleared the deck"
              description="You’ve seen this round. Refresh for anything new, or host a plan so others can find you."
              action={
                <View style={styles.emptyActions}>
                  <AppButton variant="outline" onPress={resetDeck}>
                    Reload deck
                  </AppButton>
                  <AppButton variant="ghost" onPress={() => navigation.navigate('Create')}>
                    Host a plan
                  </AppButton>
                </View>
              }
            />
          ) : null}

          {currentActivity ? (
            <AnimatedView style={[cardStyle, styles.animatedCard]} {...panResponder.panHandlers}>
              {foyerMode ? (
                <View style={styles.foyerCard}>
                  <View style={styles.foyerPhotoWrap}>
                    {coverImage ? (
                      <Image source={{ uri: coverImage }} style={styles.foyerPhoto} />
                    ) : (
                      <View style={styles.foyerPhoto} />
                    )}
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>Cover photo</Text>
                    </View>
                  </View>
                  <View style={styles.foyerBody}>
                    <View style={styles.foyerChipRow}>
                      <View style={styles.audienceChip}>
                        <Text style={styles.audienceChipText}>{audienceLabel}</Text>
                      </View>
                      <Text style={styles.goingCount}>{goingLabel}</Text>
                    </View>
                    <Text style={styles.foyerTitle}>{currentActivity.title}</Text>
                    <Text style={styles.foyerMeta}>{currentTimeLabel}</Text>
                    <Text style={styles.foyerMeta}>{currentActivity.location || 'Location TBD'}</Text>
                    {currentActivity.description ? (
                      <Text style={styles.foyerDescription}>{currentActivity.description}</Text>
                    ) : null}
                    <View style={styles.hostedRow}>
                      {foyerHostAvatar ? (
                        <Image source={{ uri: foyerHostAvatar }} style={styles.hostAvatar} />
                      ) : (
                        <View style={styles.hostAvatar}>
                          <Text style={styles.hostInitial}>{foyerHostName.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.hostedLabel}>Hosted by</Text>
                        <Text style={styles.hostedName}>{foyerHostName}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
              <View style={[styles.photoCard, ticketed ? styles.photoCardTicketed : null]}>
                {coverImage ? (
                  <Image source={{ uri: coverImage }} style={styles.photo} />
                ) : (
                  <LinearGradient
                    colors={[appColors.primary, appColors.primaryDeep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.photo}
                  >
                    <Text style={styles.photoLetter}>
                      {currentActivity.title.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(10, 8, 20, 0.92)']}
                  style={styles.photoScrim}
                >
                  <View style={styles.photoChipRow}>
                    <AccentPill tone="neutral">{currentTag}</AccentPill>
                    {ticketed ? (
                      <AccentPill tone="gold">
                        Ticket{ticketPrice != null ? ` · $${ticketPrice.toFixed(2)}` : ''}
                      </AccentPill>
                    ) : null}
                  </View>
                  <Text style={styles.photoTitle}>{currentActivity.title}</Text>
                  <View style={styles.photoMeta}>
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="map-marker-outline" size={16} color="rgba(255,255,255,0.86)" />
                      <Text style={styles.photoMetaText}>{currentActivity.location || 'Location TBD'}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color="rgba(255,255,255,0.86)" />
                      <Text style={styles.photoMetaText}>{currentTimeLabel}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons name="account-group-outline" size={16} color="rgba(255,255,255,0.86)" />
                      <Text style={styles.photoMetaText}>
                        {`${currentActivity.participant_count ?? 0}${currentActivity.capacity ? ` / ${currentActivity.capacity}` : ''}`}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
              )}
            </AnimatedView>
          ) : null}

          {currentActivity ? (
            <View style={styles.actions}>
              <AppButton variant="outline" onPress={() => handleSwipe('left')} disabled={isBusy} style={styles.actionButton}>
                Pass
              </AppButton>
              {foyerMode ? null : (
                <AppButton compact variant="ghost" onPress={() => setShowDetails(true)}>
                  Details
                </AppButton>
              )}
              <AppButton onPress={() => void startGoing()} disabled={isBusy || rsvpPending} style={styles.actionButton}>
                I'm going
              </AppButton>
            </View>
          ) : null}
          {rsvpError ? <Text style={styles.metaText}>{rsvpError}</Text> : null}

          <Portal>
            <Modal visible={showDetails} onDismiss={() => setShowDetails(false)} contentContainerStyle={styles.detailsModal}>
              {currentActivity ? (
                <ScrollView contentContainerStyle={styles.detailsScroll}>
                  <AccentPill tone={ticketed ? 'gold' : 'neutral'}>{currentTag}</AccentPill>
                  <Text variant="headlineSmall" style={styles.detailsTitle}>
                    {currentActivity.title}
                  </Text>
                  <Text variant="bodyMedium" style={styles.detailsText}>
                    {currentActivity.description || 'No description provided.'}
                  </Text>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="map-marker-outline" size={16} color={appColors.mutedInk} />
                    <Text style={styles.metaText}>{currentActivity.location || 'Location TBD'}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color={appColors.mutedInk} />
                    <Text style={styles.metaText}>{currentTimeLabel}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="account-group-outline" size={16} color={appColors.mutedInk} />
                    <Text style={styles.metaText}>
                      {currentActivity.participant_count ?? 0}
                      {currentActivity.capacity ? ` / ${currentActivity.capacity}` : ''} people
                    </Text>
                  </View>
                  {ticketed ? (
                    <AccentPill tone="gold">
                      Ticket
                      {ticketPrice != null ? ` · $${ticketPrice.toFixed(2)}` : ''}
                      {currentActivity.ticketsAvailable != null
                        ? ` · ${currentActivity.ticketsAvailable} left`
                        : ''}
                    </AccentPill>
                  ) : null}
                  {currentActivity.tags?.length ? (
                    <Text style={styles.detailsText}>Tags: {currentActivity.tags.join(', ')}</Text>
                  ) : null}
                  {typeof currentActivity.host !== 'string' &&
                  currentActivity.host &&
                  typeof (currentActivity.host as { id?: number | string }).id !== 'undefined' ? (
                    <AppButton
                      variant="ghost"
                      onPress={() => {
                        const host = currentActivity.host as { id?: number | string };
                        if (!host?.id) {
                          return;
                        }
                        setSafetyUserId(host.id);
                        setSafetyUserLabel(currentHostName);
                        setShowDetails(false);
                      }}
                    >
                      Report / block host
                    </AppButton>
                  ) : null}
                  <View style={styles.modalActions}>
                    <AppButton variant="outline" onPress={() => setShowDetails(false)}>
                      Close
                    </AppButton>
                    {ticketed ? (
                      <AppButton
                        disabled={Boolean(currentActivity.isSoldOut)}
                        onPress={() => {
                          setShowDetails(false);
                          navigation.navigate('BuyTicket', {
                            activityId: currentActivity.id,
                            title: currentActivity.title,
                            location: currentActivity.location,
                            time: currentActivity.time,
                            ticketPrice,
                            imageUri: coverImage,
                            ticketsAvailable: currentActivity.ticketsAvailable,
                            isSoldOut: currentActivity.isSoldOut,
                          });
                        }}
                      >
                        {currentActivity.isSoldOut ? 'Sold out' : 'Buy ticket'}
                      </AppButton>
                    ) : null}
                    <AppButton
                      variant="outline"
                      disabled={participationMutation.isPending}
                      loading={
                        participationMutation.isPending &&
                        participationMutation.variables?.action === 'leave'
                      }
                      onPress={() =>
                        participationMutation.mutate({
                          activityId: currentActivity.id,
                          action: 'leave',
                        })
                      }
                    >
                      Leave
                    </AppButton>
                    <AppButton
                      variant="social"
                      disabled={participationMutation.isPending || ticketed}
                      loading={
                        participationMutation.isPending &&
                        participationMutation.variables?.action === 'join'
                      }
                      onPress={() =>
                        participationMutation.mutate({
                          activityId: currentActivity.id,
                          action: 'join',
                        })
                      }
                    >
                      {ticketed ? 'Ticket required' : 'Join'}
                    </AppButton>
                    <AppButton
                      onPress={() => {
                        setShowDetails(false);
                        void startGoing();
                      }}
                    >
                      I'm going
                    </AppButton>
                  </View>
                </ScrollView>
              ) : null}
            </Modal>
          </Portal>
          {foyerMode && whosComing && currentActivity ? (
            <Portal>
              <Modal
                visible
                onDismiss={() => setWhosComing(null)}
                contentContainerStyle={styles.sheetModal}
              >
                <WhosComingSheet
                  response={whosComing}
                  subtitle={`${currentActivity.title} · ${audienceLabel}`}
                  pending={rsvpPending}
                  onConfirm={(payload) => void confirmRsvp(currentActivity, payload)}
                />
              </Modal>
            </Portal>
          ) : null}
          {foyerMode && giveTarget ? (
            <Portal>
              <Modal
                visible
                onDismiss={() => setGiveTarget(null)}
                contentContainerStyle={styles.sheetModal}
              >
                <GiveSheet
                  intro={giftIntro(giveTarget)}
                  disclaimer={giftDisclaimer(giveTarget)}
                  feeNote={giveTarget.fee_note}
                  suggested={giveTarget.suggested_donation}
                  onGive={async (amount) => {
                    const link = await postGivingLink(giveTarget.id, amount);
                    return link.url;
                  }}
                  onDismiss={() => setGiveTarget(null)}
                />
              </Modal>
            </Portal>
          ) : null}
    </AppScrollView>
    <SafetyActionsModal
      visible={safetyUserId != null}
      userId={safetyUserId}
      userLabel={safetyUserLabel}
      onClose={() => {
        setSafetyUserId(null);
        setSafetyUserLabel(undefined);
      }}
      onBlocked={() => {
        void queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
        setCurrentIndex((previous) => previous + 1);
      }}
    />
    <MatchCelebration
      visible={!!matchMessage}
      message={matchMessage ?? undefined}
      matchName={matchContext?.name}
      activityTitle={matchContext?.title}
      onPrimaryAction={() => {
        // Jump to the Chat tab inside the parent tab navigator.
        const parent = navigation.getParent();
        parent?.navigate('Chat' as never);
      }}
      onDismiss={() => {
        setMatchMessage(null);
        setMatchContext(null);
      }}
    />
    <Snackbar
      visible={vibeToastVisible}
      onDismiss={() => setVibeToastVisible(false)}
      duration={3500}
      action={{ label: 'Got it', onPress: () => setVibeToastVisible(false) }}
    >
      Personalized feed unlocked.
    </Snackbar>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  vibeReminderCard: {
    gap: 8,
  },
  vibeReminderTitle: {
    color: appColors.ink,
    fontWeight: '600',
  },
  vibeReminderSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  vibeReminderActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  loadingText: {
    color: appColors.mutedInk,
  },
  skeletonCard: {
    gap: 0,
  },
  filterCard: {
    gap: 8,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  filterHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  filterTitle: {
    color: appColors.ink,
    fontWeight: '600',
  },
  filterSubtitle: {
    color: appColors.mutedInk,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mapCard: {
    gap: 10,
  },
  mapTitle: {
    color: appColors.ink,
    fontWeight: '600',
  },
  mapSubtitle: {
    color: appColors.mutedInk,
  },
  map: {
    height: 240,
    borderRadius: 18,
  },
  errorContainer: {
    gap: 8,
  },
  errorText: {
    color: appColors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyActions: {
    gap: 8,
  },
  animatedCard: {
    width: '100%',
  },
  photoCard: {
    overflow: 'hidden',
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    backgroundColor: appColors.card,
  },
  photoCardTicketed: {
    borderColor: appColors.primary,
  },
  photo: {
    width: '100%',
    height: 420,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLetter: {
    color: appColors.white,
    fontSize: 72,
    fontWeight: '600',
    opacity: 0.35,
  },
  photoScrim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
    gap: 8,
  },
  photoChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoTitle: {
    color: appColors.white,
    fontFamily: appTypography.heading,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  photoMeta: {
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: appColors.mutedInk,
    fontSize: 14,
    flex: 1,
  },
  photoMetaText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
  },
  foyerCard: {
    backgroundColor: appColors.white,
    borderRadius: radii.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  foyerPhotoWrap: {
    height: 210,
    backgroundColor: '#c4b2a8',
  },
  foyerPhoto: {
    width: '100%',
    height: 210,
    backgroundColor: '#c4b2a8',
  },
  coverBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    backgroundColor: 'rgba(20,14,16,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coverBadgeText: {
    color: appColors.white,
    fontSize: 12,
    fontFamily: appTypography.bodyMedium,
  },
  foyerBody: {
    padding: 16,
    gap: 8,
  },
  foyerChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audienceChip: {
    backgroundColor: appColors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  audienceChipText: {
    color: appColors.primary,
    fontFamily: appTypography.bodySemibold,
    fontSize: 13,
  },
  goingCount: {
    color: appColors.mutedInk,
    fontFamily: appTypography.bodyMedium,
    fontSize: 14,
  },
  foyerTitle: {
    fontFamily: appTypography.heading,
    fontSize: 25,
    color: appColors.ink,
  },
  foyerMeta: {
    color: appColors.ink,
    fontFamily: appTypography.bodyRegular,
    fontSize: 15,
  },
  foyerDescription: {
    color: appColors.ink,
    fontFamily: appTypography.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  hostedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.line,
  },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInitial: {
    color: appColors.primary,
    fontFamily: appTypography.bodySemibold,
  },
  hostedLabel: {
    color: appColors.mutedInk,
    fontFamily: appTypography.bodyRegular,
    fontSize: 12,
  },
  hostedName: {
    color: appColors.ink,
    fontFamily: appTypography.bodySemibold,
    fontSize: 15,
  },
  sheetModal: {
    backgroundColor: 'transparent',
    marginHorizontal: 0,
    marginBottom: 0,
    justifyContent: 'flex-end',
  },
  detailsModal: {
    backgroundColor: appColors.card,
    margin: 16,
    padding: 18,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    maxHeight: '80%',
  },
  detailsScroll: {
    gap: 10,
  },
  detailsTitle: {
    color: appColors.ink,
    fontWeight: '600',
  },
  detailsText: {
    marginVertical: 8,
    color: appColors.mutedInk,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
});
