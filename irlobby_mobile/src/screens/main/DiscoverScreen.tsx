import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import MapView, { Marker } from 'react-native-maps';
import {
  Button,
  Card,
  HelperText,
  IconButton,
  Modal,
  Portal,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchActivities,
  joinActivity,
  leaveActivity,
  swipeActivity,
  type ActivityFetchFilters,
} from '@services/activityService';
import { getErrorMessage } from '@utils/error';

import type { MainStackParamList } from '@navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const DiscoverScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

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
        setMatchMessage('It\'s a match! Check your matches tab.');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setMatchMessage(null);
      }

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
  const isAnimatingRef = useRef(false);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swipeRatio = useDerivedValue(() => (windowWidth ? translateX.value / windowWidth : 0));

  const resetCardPosition = useCallback(() => {
    translateX.value = withSpring(0, { damping: 16, stiffness: 180 });
    translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
  }, [translateX, translateY]);

  const completeSwipe = useCallback(
    (direction: 'left' | 'right', activityId: number | string) => {
      swipeMutation.mutate({ activityId, direction });
    },
    [swipeMutation],
  );

  const animateOffscreen = useCallback(
    (direction: 'left' | 'right', activityId: number | string) => {
      if (isAnimatingRef.current || isBusy) {
        return;
      }

      isAnimatingRef.current = true;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const offscreenX = windowWidth * 1.3;
      translateX.value = withTiming(direction === 'right' ? offscreenX : -offscreenX, { duration: 220 },
        (finished) => {
          if (finished) {
            runOnJS(setCurrentIndex)((prev) => prev + 1);
            runOnJS(completeSwipe)(direction, activityId);
          }

          translateX.value = 0;
          translateY.value = 0;
          isAnimatingRef.current = false;
        },
      );
      translateY.value = withTiming(0, { duration: 220 });
    },
    [completeSwipe, isBusy, translateX, translateY, windowWidth],
  );

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (!currentActivity) {
        return;
      }

      animateOffscreen(direction, currentActivity.id);
    },
    [animateOffscreen, currentActivity],
  );

  const swipeThreshold = Math.max(90, windowWidth * 0.28);

  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(!!currentActivity && !isBusy)
      .activeOffsetX([-10, 10])
      .failOffsetY([-14, 14])
      .onUpdate((event) => {
        translateX.value = event.translationX;
        translateY.value = event.translationY * 0.12;
      })
      .onEnd(() => {
        const shouldSwipe = Math.abs(translateX.value) > swipeThreshold;

        if (shouldSwipe && currentActivity) {
          runOnJS(handleSwipe)(translateX.value > 0 ? 'right' : 'left');
          return;
        }

        runOnJS(resetCardPosition)();
      });
  }, [currentActivity, handleSwipe, isBusy, resetCardPosition, swipeThreshold, translateX, translateY]);

  const resetDeck = useCallback(() => {
    setCurrentIndex(0);
    setMatchMessage(null);
    resetCardPosition();
    void refetch();
  }, [refetch, resetCardPosition]);

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

  const activeCardStyle = useAnimatedStyle(() => {
    const rotateZ = `${swipeRatio.value * 12}deg`;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateZ },
      ],
    };
  }, []);

  const likeOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [0, swipeThreshold], [0, 1]);
    return { opacity: Math.max(0, Math.min(1, opacity)) };
  }, [swipeThreshold]);

  const passOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [-swipeThreshold, 0], [1, 0]);
    return { opacity: Math.max(0, Math.min(1, opacity)) };
  }, [swipeThreshold]);

  const visibleActivities = activities.slice(currentIndex, currentIndex + 3);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingBottom: insets.bottom + 140,
          },
        ]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      >
        <Text variant="headlineSmall">Discover Events</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Find activities near you.
        </Text>

      <View style={styles.toolbar}>
        <Button mode="outlined" onPress={() => setShowFilters((prev) => !prev)}>
          {showFilters ? 'Hide filters' : 'Filters'}
        </Button>
        <Button mode="outlined" onPress={() => setShowMap((prev) => !prev)}>
          {showMap ? 'Hide map' : 'Map'}
        </Button>
        <Button mode="outlined" onPress={() => navigation.navigate('Notifications')}>
          Notifications
        </Button>
      </View>

      {showFilters && (
        <Surface elevation={1} style={styles.filterCard}>
          <Text variant="titleMedium">Filters</Text>
          <TextInput
            label="Category (tag)"
            value={categoryFilter}
            onChangeText={setCategoryFilter}
            style={styles.input}
          />
          <TextInput
            label="Location"
            value={locationFilter}
            onChangeText={setLocationFilter}
            style={styles.input}
          />
          <TextInput
            label="Tags (comma separated)"
            value={tagFilter}
            onChangeText={setTagFilter}
            style={styles.input}
          />
          <TextInput
            label="Max distance (km)"
            value={distanceFilter}
            onChangeText={setDistanceFilter}
            keyboardType="numeric"
            style={styles.input}
          />
          <TextInput
            label="Skill level"
            value={skillFilter}
            onChangeText={setSkillFilter}
            style={styles.input}
          />
          <TextInput
            label="Age restriction"
            value={ageFilter}
            onChangeText={setAgeFilter}
            style={styles.input}
          />
          <TextInput
            label="Visibility (everyone/friends/friendsOfFriends)"
            value={visibilityFilter}
            onChangeText={setVisibilityFilter}
            style={styles.input}
          />
          <View style={styles.filterRow}>
            <TextInput
              label="Price min"
              value={priceMinFilter}
              onChangeText={setPriceMinFilter}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              label="Price max"
              value={priceMaxFilter}
              onChangeText={setPriceMaxFilter}
              keyboardType="numeric"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <TextInput
            label="Date from (YYYY-MM-DD or ISO)"
            value={dateFromFilter}
            onChangeText={setDateFromFilter}
            style={styles.input}
          />
          <TextInput
            label="Date to (YYYY-MM-DD or ISO)"
            value={dateToFilter}
            onChangeText={setDateToFilter}
            style={styles.input}
          />
          <Button mode="text" onPress={resetFilters}>
            Reset filters
          </Button>
        </Surface>
      )}

      {showMap && activities.length > 0 && (
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
      )}

      {isLoading && <Text>Loading activities...</Text>}

      {(error || swipeMutation.error) && (
        <View style={styles.errorContainer}>
          <HelperText type="error" visible>
            {getErrorMessage(error ?? swipeMutation.error, 'Unable to load activities.')}
          </HelperText>
          <Button mode="outlined" onPress={() => void refetch()} disabled={isRefetching}>
            {isRefetching ? 'Retrying...' : 'Retry'}
          </Button>
        </View>
      )}

      {participationMutation.error && (
        <HelperText type="error" visible>
          {getErrorMessage(participationMutation.error, 'Unable to update participation.')}
        </HelperText>
      )}

      {matchMessage && (
        <HelperText type="info" visible>
          {matchMessage}
        </HelperText>
      )}

      {!isLoading && activities.length === 0 && (
        <Card>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">No activities match your current filters</Text>
            <Text style={styles.secondaryText}>Check back later for new events in your area.</Text>
            <Button mode="contained" onPress={resetDeck}>
              Refresh
            </Button>
          </Card.Content>
        </Card>
      )}

      {!isLoading && activities.length > 0 && !currentActivity && (
        <Card>
          <Card.Content style={styles.cardContent}>
            <Text>You&apos;re all caught up.</Text>
            <Button mode="outlined" onPress={resetDeck}>
              Reload activities
            </Button>
          </Card.Content>
        </Card>
      )}

        <View style={styles.deckWrap}>
          {visibleActivities.length === 0 ? null : (
            <View style={styles.deck}>
              {visibleActivities
                .map((activity, index) => ({ activity, index }))
                .reverse()
                .map(({ activity, index }) => {
                  const isActive = index === 0;
                  const stackOffset = index * 6;
                  const scale = 1 - index * 0.03;

                  const baseStyle = {
                    top: stackOffset,
                    transform: [{ scale }],
                    opacity: 1 - index * 0.12,
                  } as const;

                  if (!isActive) {
                    return (
                      <Animated.View
                        key={String(activity.id)}
                        style={[styles.cardShell, baseStyle]}
                      >
                        <Card style={styles.card}>
                          <Card.Content style={styles.cardContent}>
                            <Text variant="titleMedium">{activity.title}</Text>
                            {!!activity.location && <Text>📍 {activity.location}</Text>}
                            {!!activity.time && <Text>🕒 {new Date(activity.time).toLocaleString()}</Text>}
                          </Card.Content>
                        </Card>
                      </Animated.View>
                    );
                  }

                  return (
                    <GestureDetector key={String(activity.id)} gesture={panGesture}>
                      <Animated.View style={[styles.cardShell, baseStyle, activeCardStyle]}>
                        <Animated.View
                          style={[
                            styles.overlay,
                            styles.passOverlay,
                            { backgroundColor: theme.colors.errorContainer },
                            passOverlayStyle,
                          ]}
                        >
                          <Text style={[styles.overlayText, { color: theme.colors.onErrorContainer }]}>PASS</Text>
                        </Animated.View>
                        <Animated.View
                          style={[
                            styles.overlay,
                            styles.likeOverlay,
                            { backgroundColor: theme.colors.secondaryContainer },
                            likeOverlayStyle,
                          ]}
                        >
                          <Text
                            style={[styles.overlayText, { color: theme.colors.onSecondaryContainer }]}
                          >
                            LIKE
                          </Text>
                        </Animated.View>

                        <Card style={styles.card}>
                          <Card.Content style={styles.cardContent}>
                            <Text variant="titleMedium">{activity.title}</Text>
                            {!!activity.description && (
                              <Text numberOfLines={3}>{activity.description}</Text>
                            )}
                            {!!activity.location && <Text>📍 {activity.location}</Text>}
                            {!!activity.time && (
                              <Text>🕒 {new Date(activity.time).toLocaleString()}</Text>
                            )}
                            <Text>
                              👥 {activity.participant_count ?? 0}
                              {activity.capacity ? ` / ${activity.capacity}` : ''}
                            </Text>
                            <Button
                              mode="text"
                              onPress={() => {
                                void Haptics.selectionAsync();
                                setShowDetails(true);
                              }}
                            >
                              View details
                            </Button>
                          </Card.Content>
                        </Card>
                      </Animated.View>
                    </GestureDetector>
                  );
                })}
            </View>
          )}
        </View>

      <Portal>
        <Modal visible={showDetails} onDismiss={() => setShowDetails(false)} contentContainerStyle={styles.detailsModal}>
          {currentActivity ? (
            <ScrollView>
              <Text variant="headlineSmall">{currentActivity.title}</Text>
              <Text variant="bodyMedium" style={styles.detailsText}>
                {currentActivity.description || 'No description provided.'}
              </Text>
              <Text>📍 {currentActivity.location || 'Location TBD'}</Text>
              <Text>
                🕒 {currentActivity.time ? new Date(currentActivity.time).toLocaleString() : 'Time TBD'}
              </Text>
              <Text>
                👥 {currentActivity.participant_count ?? 0}
                {currentActivity.capacity ? ` / ${currentActivity.capacity}` : ''}
              </Text>
              {!!currentActivity.tags?.length && (
                <Text style={styles.detailsText}>Tags: {currentActivity.tags.join(', ')}</Text>
              )}
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
                <Button mode="contained" onPress={() => { setShowDetails(false); handleSwipe('right'); }}>
                  Swipe right
                </Button>
              </View>
            </ScrollView>
          ) : null}
        </Modal>
      </Portal>
      </ScrollView>

      {currentActivity ? (
        <View
          style={[
            styles.actionBar,
            {
              paddingBottom: insets.bottom + 12,
              backgroundColor: theme.colors.elevation.level2,
              borderTopColor: theme.colors.outlineVariant,
            },
          ]}
        >
          <IconButton
            icon="close"
            mode="outlined"
            size={28}
            disabled={isBusy}
            onPress={() => {
              void Haptics.selectionAsync();
              handleSwipe('left');
            }}
          />
          <IconButton
            icon="information-outline"
            mode="outlined"
            size={26}
            onPress={() => {
              void Haptics.selectionAsync();
              setShowDetails(true);
            }}
          />
          <IconButton
            icon="heart"
            mode="contained"
            size={28}
            disabled={isBusy}
            onPress={() => {
              void Haptics.selectionAsync();
              handleSwipe('right');
            }}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 12,
  },
  subtitle: {
    opacity: 0.75,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterCard: {
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  input: {
    backgroundColor: 'transparent',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  map: {
    height: 240,
    borderRadius: 12,
  },
  card: {
    marginBottom: 8,
  },
  deckWrap: {
    minHeight: 440,
  },
  deck: {
    position: 'relative',
    height: 440,
  },
  cardShell: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  cardContent: {
    gap: 8,
  },
  secondaryText: {
    opacity: 0.7,
  },
  errorContainer: {
    gap: 8,
  },
  overlay: {
    position: 'absolute',
    top: 18,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  likeOverlay: {
    left: 18,
  },
  passOverlay: {
    right: 18,
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  detailsModal: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    maxHeight: '80%',
  },
  detailsText: {
    marginVertical: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
