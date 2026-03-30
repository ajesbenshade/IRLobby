import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Button, HelperText, Modal, Portal, Text, TextInput } from 'react-native-paper';

import {
  AccentPill,
  AppScrollView,
  EmptyStatePanel,
  PageHeader,
  PanelCard,
} from '@components/AppChrome';
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

export const DiscoverScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const pan = useRef(new Animated.ValueXY()).current;
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
        setMatchMessage("It's a match! Check your matches tab.");
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

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <PageHeader
        eyebrow="Flagship"
        title="Discover events"
        subtitle="Swipe through activities with cleaner hierarchy, better context, and faster decisions."
        rightContent={
          <Button compact mode="text" onPress={() => navigation.navigate('Notifications')}>
            Alerts
          </Button>
        }
      />

      <View style={styles.toolbar}>
        <Button mode={showFilters ? 'contained-tonal' : 'outlined'} onPress={() => setShowFilters((previous) => !previous)}>
          {showFilters ? 'Hide filters' : `Filters${activeFilterCount ? ` (${activeFilterCount})` : ''}`}
        </Button>
        <Button mode={showMap ? 'contained-tonal' : 'outlined'} onPress={() => setShowMap((previous) => !previous)}>
          {showMap ? 'Hide map' : 'Map'}
        </Button>
        <AccentPill tone="secondary">{activities.length} live</AccentPill>
      </View>

      {showFilters ? (
        <PanelCard style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <View style={styles.filterHeaderCopy}>
              <Text variant="titleMedium" style={styles.filterTitle}>
                Refine the deck
              </Text>
              <Text style={styles.filterSubtitle}>Adjust discovery without leaving the screen.</Text>
            </View>
            <Button mode="text" compact onPress={resetFilters}>
              Reset
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
            Nearby view
          </Text>
          <Text style={styles.mapSubtitle}>Tap a pin to jump straight into that activity.</Text>
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

      {isLoading ? <Text style={styles.loadingText}>Loading activities...</Text> : null}

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
        <PanelCard style={styles.matchCard} tone="accent">
          <AccentPill tone="secondary">New match</AccentPill>
          <Text variant="titleMedium" style={styles.matchTitle}>
            {matchMessage}
          </Text>
        </PanelCard>
      ) : null}

      {!isLoading && activities.length === 0 ? (
        <EmptyStatePanel
          title="No activities match your filters"
          description="Widen the radius, clear a few filters, or refresh to pull in the latest nearby events."
          action={
            <Button mode="contained" buttonColor={appColors.primary} onPress={resetDeck}>
              Refresh deck
            </Button>
          }
        />
      ) : null}

      {!isLoading && activities.length > 0 && !currentActivity ? (
        <EmptyStatePanel
          title="You’re all caught up"
          description="You’ve seen the current deck. Refresh to reshuffle and load anything new."
          action={
            <Button mode="outlined" onPress={resetDeck}>
              Reload activities
            </Button>
          }
        />
      ) : null}

      {currentActivity ? (
        <Animated.View style={[cardStyle, styles.animatedCard]} {...panResponder.panHandlers}>
          <PanelCard style={styles.card}>
            <View style={styles.cardHero}>
              <AccentPill tone="secondary">{currentTag}</AccentPill>
              <Text style={styles.cardHeroLetter}>{currentActivity.title.charAt(0).toUpperCase()}</Text>
              <Text style={styles.cardHeroText}>Swipe right if you’d show up. Left if it’s not your scene.</Text>
            </View>
            <View style={styles.cardContent}>
              <Text variant="headlineSmall" style={styles.cardTitle}>
                {currentActivity.title}
              </Text>
              {currentActivity.description ? (
                <Text style={styles.cardDescription} numberOfLines={3}>
                  {currentActivity.description}
                </Text>
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
                  <Text style={styles.hostLabel}>Host</Text>
                </View>
                <Button mode="text" compact onPress={() => setShowDetails(true)}>
                  View details
                </Button>
              </View>
            </View>
          </PanelCard>
        </Animated.View>
      ) : null}

      {currentActivity ? (
        <View style={styles.actions}>
          <Button mode="outlined" onPress={() => handleSwipe('left')} disabled={isBusy} style={styles.actionButton}>
            Swipe left
          </Button>
          <Button
            mode="contained"
            onPress={() => handleSwipe('right')}
            disabled={isBusy}
            style={styles.actionButton}
            buttonColor={appColors.primary}
          >
            Swipe right
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
                  Swipe right
                </Button>
              </View>
            </ScrollView>
          ) : null}
        </Modal>
      </Portal>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
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
    backgroundColor: '#eef2ff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 14,
  },
  cardHeroLetter: {
    color: appColors.primaryDeep,
    fontSize: 46,
    fontWeight: '900',
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
    borderTopColor: '#eef2f7',
    paddingTop: 14,
  },
  hostAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebefff',
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
