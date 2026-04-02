import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Button, HelperText, Modal, Portal, SegmentedButtons, Text } from 'react-native-paper';

import {
  AccentPill,
  AppScrollView,
  EmptyStatePanel,
  PageHeader,
  PanelCard,
} from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { RefreshControl, ScrollView, Text as NativeText, View } from '@components/RNCompat';
import { HomeOverviewContent } from '@screens/main/HomeScreen';
import type { MainStackParamList } from '@navigation/types';
import {
  fetchActivities,
  joinActivity,
  leaveActivity,
  swipeActivity,
  type ActivityFetchFilters,
} from '@services/activityService';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const AnimatedView = Animated.View as unknown as ComponentType<any>;

export const DiscoverScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const pan = useRef(new Animated.ValueXY()).current;
  const [activeSegment, setActiveSegment] = useState<'discover' | 'home'>('discover');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchMessage, setMatchMessage] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [distanceFilter, setDistanceFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [priceMinFilter, setPriceMinFilter] = useState('');
  const [priceMaxFilter, setPriceMaxFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const matchCardOpacity = useRef(new Animated.Value(0)).current;
  const matchCardLift = useRef(new Animated.Value(16)).current;

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
      price_min: priceMinFilter.trim() ? Number(priceMinFilter) : undefined,
      price_max: priceMaxFilter.trim() ? Number(priceMaxFilter) : undefined,
      date_from: normalizeDateFilter(dateFromFilter, false),
      date_to: normalizeDateFilter(dateToFilter, true),
    }),
    [
      ageFilter,
      categoryFilter,
      dateFromFilter,
      dateToFilter,
      distanceFilter,
      locationFilter,
      normalizeDateFilter,
      priceMaxFilter,
      priceMinFilter,
      skillFilter,
      tagFilter,
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
  });

  const swipeMutation = useMutation({
    mutationFn: ({ activityId, direction }: { activityId: number | string; direction: 'left' | 'right' }) =>
      swipeActivity(activityId, direction),
    onSuccess: async (data, variables) => {
      if (variables.direction === 'right' && data.matched) {
        setMatchMessage('New spark unlocked. Your match is waiting in chat.');
      } else {
        setMatchMessage(null);
      }

      setCurrentIndex((previous) => previous + 1);

      await queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-matches'] });
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
        priceMinFilter,
        priceMaxFilter,
        dateFromFilter,
        dateToFilter,
      ].filter((value) => value.trim().length > 0).length,
    [
      ageFilter,
      categoryFilter,
      dateFromFilter,
      dateToFilter,
      distanceFilter,
      locationFilter,
      priceMaxFilter,
      priceMinFilter,
      skillFilter,
      tagFilter,
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

      animateSwipe(direction, () => {
        swipeMutation.mutate({
          activityId: currentActivity.id,
          direction,
        });
      });
    },
    [animateSwipe, currentActivity, isBusy, swipeMutation],
  );

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
    [handleSwipe, isBusy, pan],
  );

  const resetDeck = useCallback(() => {
    setCurrentIndex(0);
    setMatchMessage(null);
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
    setPriceMinFilter('');
    setPriceMaxFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setCurrentIndex(0);
  }, []);

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
  const currentTimeLabel = currentActivity?.time
    ? new Date(currentActivity.time).toLocaleString()
    : 'Time TBD';

  useEffect(() => {
    if (!matchMessage) {
      matchCardOpacity.setValue(0);
      matchCardLift.setValue(16);
      return;
    }

    Animated.parallel([
      Animated.timing(matchCardOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(matchCardLift, {
        toValue: 0,
        friction: 8,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [matchCardLift, matchCardOpacity, matchMessage]);

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <PageHeader
        eyebrow={activeSegment === 'discover' ? 'For you' : 'Quick pulse'}
        title={activeSegment === 'discover' ? 'Find the plan worth leaving for' : 'A fast read on your scene'}
        subtitle={
          activeSegment === 'discover'
            ? 'Scroll the live deck first, then flip over to Home whenever you want the quick version of what you are hosting.'
            : 'Check your counts, latest hosted plans, and jump back into discovery without adding another tab.'
        }
        rightContent={
          activeSegment === 'discover' ? (
            <Button compact mode="text" onPress={() => navigation.navigate('Notifications')}>
              Pings
            </Button>
          ) : null
        }
      />

      <PanelCard style={styles.segmentShell} tone={activeSegment === 'discover' ? 'default' : 'warm'}>
        <View style={styles.segmentShellHeader}>
          <AccentPill tone={activeSegment === 'discover' ? 'secondary' : 'neutral'}>
            {activeSegment === 'discover' ? 'Swipe mode' : 'Pulse mode'}
          </AccentPill>
          <Text style={styles.segmentShellCopy}>
            {activeSegment === 'discover'
              ? 'Discover stays front and center. Home is still one tap away when you want the quick version.'
              : 'Home stays compact here so the swipe deck keeps the spotlight.'}
          </Text>
        </View>
        <SegmentedButtons
          value={activeSegment}
          onValueChange={(value) => setActiveSegment(value as 'discover' | 'home')}
          buttons={[
            { value: 'discover', label: 'Discover' },
            { value: 'home', label: 'Home' },
          ]}
          style={styles.segmentedControl}
        />
      </PanelCard>

      {activeSegment === 'home' ? (
        <HomeOverviewContent compact onOpenDiscover={() => setActiveSegment('discover')} />
      ) : (
        <>
          <View style={styles.toolbar}>
            <Button mode={showFilters ? 'contained-tonal' : 'outlined'} onPress={() => setShowFilters((previous) => !previous)}>
              {showFilters ? 'Hide vibe filters' : `Vibe filters${activeFilterCount ? ` (${activeFilterCount})` : ''}`}
            </Button>
            <Button mode={showMap ? 'contained-tonal' : 'outlined'} onPress={() => setShowMap((previous) => !previous)}>
              {showMap ? 'Hide map' : 'Map view'}
            </Button>
            <AccentPill tone="secondary">{activities.length} live now</AccentPill>
          </View>

          {showFilters ? (
            <PanelCard style={styles.filterCard}>
              <View style={styles.filterHeader}>
                <View style={styles.filterHeaderCopy}>
                  <Text variant="titleMedium" style={styles.filterTitle}>
                    Tune your vibe
                  </Text>
                  <Text style={styles.filterSubtitle}>Tighten the deck without leaving the moment.</Text>
                </View>
                <Button mode="text" compact onPress={resetFilters}>
                  Clear
                </Button>
              </View>
              <TextInput label="Category (tag)" value={categoryFilter} onChangeText={setCategoryFilter} mode="outlined" style={styles.input} />
              <TextInput label="Location" value={locationFilter} onChangeText={setLocationFilter} mode="outlined" style={styles.input} />
              <TextInput label="Tags (comma separated)" value={tagFilter} onChangeText={setTagFilter} mode="outlined" style={styles.input} />
              <TextInput
                label="Max distance (km)"
                value={distanceFilter}
                onChangeText={setDistanceFilter}
                keyboardType="numeric"
                mode="outlined"
                style={styles.input}
              />
              <TextInput label="Skill level" value={skillFilter} onChangeText={setSkillFilter} mode="outlined" style={styles.input} />
              <TextInput label="Age restriction" value={ageFilter} onChangeText={setAgeFilter} mode="outlined" style={styles.input} />
              <TextInput
                label="Visibility (everyone/friends/friendsOfFriends)"
                value={visibilityFilter}
                onChangeText={setVisibilityFilter}
                mode="outlined"
                style={styles.input}
              />
              <View style={styles.filterRow}>
                <TextInput
                  label="Price min"
                  value={priceMinFilter}
                  onChangeText={setPriceMinFilter}
                  keyboardType="numeric"
                  mode="outlined"
                  style={[styles.input, styles.halfInput]}
                />
                <TextInput
                  label="Price max"
                  value={priceMaxFilter}
                  onChangeText={setPriceMaxFilter}
                  keyboardType="numeric"
                  mode="outlined"
                  style={[styles.input, styles.halfInput]}
                />
              </View>
              <TextInput
                label="Date from (YYYY-MM-DD or ISO)"
                value={dateFromFilter}
                onChangeText={setDateFromFilter}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Date to (YYYY-MM-DD or ISO)"
                value={dateToFilter}
                onChangeText={setDateToFilter}
                mode="outlined"
                style={styles.input}
              />
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

          {isLoading ? <Text style={styles.loadingText}>Pulling in fresh plans...</Text> : null}

          {error || swipeMutation.error ? (
            <View style={styles.errorContainer}>
              <HelperText type="error" visible>
                {getErrorMessage(error ?? swipeMutation.error, 'Unable to load activities.')}
              </HelperText>
              <Button mode="outlined" onPress={() => void refetch()} disabled={isRefetching}>
                {isRefetching ? 'Retrying...' : 'Retry'}
              </Button>
            </View>
          ) : null}

          {participationMutation.error ? (
            <HelperText type="error" visible>
              {getErrorMessage(participationMutation.error, 'Unable to update participation.')}
            </HelperText>
          ) : null}

          {matchMessage ? (
            <AnimatedView
              style={{
                opacity: matchCardOpacity,
                transform: [{ translateY: matchCardLift }],
              }}
            >
              <PanelCard style={styles.matchCard} tone="accent">
                <AccentPill tone="secondary">New spark</AccentPill>
                <Text variant="titleMedium" style={styles.matchTitle}>
                  {matchMessage}
                </Text>
              </PanelCard>
            </AnimatedView>
          ) : null}

          {!isLoading && activities.length === 0 ? (
            <EmptyStatePanel
              title="Nothing matches this vibe yet"
              description="Widen the radius, clear a few filters, or refresh to pull in the latest nearby plans."
              action={
                <Button mode="contained" buttonColor={appColors.primary} onPress={resetDeck}>
                  Refresh deck
                </Button>
              }
            />
          ) : null}

          {!isLoading && activities.length > 0 && !currentActivity ? (
            <EmptyStatePanel
              title="You cleared the deck"
              description="You’ve seen the current round. Refresh to reshuffle and catch anything new."
              action={
                <Button mode="outlined" onPress={resetDeck}>
                  Reload deck
                </Button>
              }
            />
          ) : null}

          {currentActivity ? (
            <AnimatedView style={[cardStyle, styles.animatedCard]} {...panResponder.panHandlers}>
              <PanelCard style={styles.card}>
                <View style={styles.cardHero}>
                  <AccentPill tone="secondary">{currentTag}</AccentPill>
                  <Text style={styles.cardHeroLetter}>{currentActivity.title.charAt(0).toUpperCase()}</Text>
                  <Text style={styles.cardHeroText}>Swipe right if you would actually pull up. Left if it is not your scene.</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text variant="headlineSmall" style={styles.cardTitle}>
                    {currentActivity.title}
                  </Text>
                  {currentActivity.description ? (
                    <NativeText style={styles.cardDescription} numberOfLines={3}>
                      {currentActivity.description}
                    </NativeText>
                  ) : null}
                  <View style={styles.metaStack}>
                    <Text style={styles.metaLine}>📍 {currentActivity.location || 'Location TBD'}</Text>
                    <Text style={styles.metaLine}>🕒 {currentTimeLabel}</Text>
                    <Text style={styles.metaLine}>
                      👥 {currentActivity.participant_count ?? 0}
                      {currentActivity.capacity ? ` / ${currentActivity.capacity}` : ''} people
                    </Text>
                  </View>
                  <View style={styles.hostRow}>
                    <View style={styles.hostAvatar}>
                      <Text style={styles.hostAvatarText}>{currentHostName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.hostCopy}>
                      <Text style={styles.hostName}>{currentHostName}</Text>
                      <Text style={styles.hostLabel}>Hosting</Text>
                    </View>
                    <Button mode="text" compact onPress={() => setShowDetails(true)}>
                      Details
                    </Button>
                  </View>
                </View>
              </PanelCard>
            </AnimatedView>
          ) : null}

          {currentActivity ? (
            <View style={styles.actions}>
              <Button mode="outlined" onPress={() => handleSwipe('left')} disabled={isBusy} style={styles.actionButton}>
                Pass
              </Button>
              <Button
                mode="contained"
                onPress={() => handleSwipe('right')}
                disabled={isBusy}
                style={styles.actionButton}
                buttonColor={appColors.primary}
              >
                I’m down
              </Button>
            </View>
          ) : null}

          <Portal>
            <Modal visible={showDetails} onDismiss={() => setShowDetails(false)} contentContainerStyle={styles.detailsModal}>
              {currentActivity ? (
                <ScrollView contentContainerStyle={styles.detailsScroll}>
                  <AccentPill tone="secondary">{currentTag}</AccentPill>
                  <Text variant="headlineSmall" style={styles.detailsTitle}>
                    {currentActivity.title}
                  </Text>
                  <Text variant="bodyMedium" style={styles.detailsText}>
                    {currentActivity.description || 'No description provided.'}
                  </Text>
                  <Text style={styles.metaLine}>📍 {currentActivity.location || 'Location TBD'}</Text>
                  <Text style={styles.metaLine}>🕒 {currentTimeLabel}</Text>
                  <Text style={styles.metaLine}>
                    👥 {currentActivity.participant_count ?? 0}
                    {currentActivity.capacity ? ` / ${currentActivity.capacity}` : ''} people
                  </Text>
                  {currentActivity.tags?.length ? (
                    <Text style={styles.detailsText}>Tags: {currentActivity.tags.join(', ')}</Text>
                  ) : null}
                  <View style={styles.modalActions}>
                    <Button mode="outlined" onPress={() => setShowDetails(false)}>
                      Close
                    </Button>
                    <Button
                      mode="outlined"
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
                    </Button>
                    <Button
                      mode="contained-tonal"
                      disabled={participationMutation.isPending}
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
                      Join
                    </Button>
                    <Button
                      mode="contained"
                      buttonColor={appColors.primary}
                      onPress={() => {
                        setShowDetails(false);
                        handleSwipe('right');
                      }}
                    >
                      I’m down
                    </Button>
                  </View>
                </ScrollView>
              ) : null}
            </Modal>
          </Portal>
        </>
      )}
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  segmentShell: {
    gap: 12,
    paddingVertical: 14,
    backgroundColor: '#fff1f6',
    borderColor: '#ffd2e0',
  },
  segmentShellHeader: {
    gap: 8,
  },
  segmentShellCopy: {
    color: appColors.mutedInk,
    lineHeight: 20,
  },
  segmentedControl: {
    marginBottom: 0,
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
    fontWeight: '800',
  },
  filterSubtitle: {
    color: appColors.mutedInk,
  },
  input: {
    backgroundColor: appColors.card,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  mapCard: {
    gap: 10,
  },
  mapTitle: {
    color: appColors.ink,
    fontWeight: '800',
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
  matchCard: {
    gap: 10,
    borderColor: '#b5f1e5',
  },
  matchTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  animatedCard: {
    width: '100%',
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  cardHero: {
    backgroundColor: '#ffeef5',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 14,
  },
  cardHeroLetter: {
    color: appColors.primaryDeep,
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1,
  },
  cardHeroText: {
    color: appColors.mutedInk,
    lineHeight: 22,
  },
  cardContent: {
    gap: 14,
    padding: 20,
  },
  cardTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  cardDescription: {
    color: appColors.mutedInk,
    lineHeight: 22,
  },
  metaStack: {
    gap: 8,
  },
  metaLine: {
    color: appColors.ink,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3e2ea',
    paddingTop: 14,
  },
  hostAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe1ec',
  },
  hostAvatarText: {
    color: appColors.primaryDeep,
    fontWeight: '900',
    fontSize: 16,
  },
  hostCopy: {
    flex: 1,
  },
  hostName: {
    color: appColors.ink,
    fontWeight: '700',
  },
  hostLabel: {
    color: appColors.mutedInk,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
  },
  detailsModal: {
    backgroundColor: appColors.card,
    margin: 16,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f3dfe8',
    maxHeight: '80%',
  },
  detailsScroll: {
    gap: 10,
  },
  detailsTitle: {
    color: appColors.ink,
    fontWeight: '800',
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
