import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Button, Card, HelperText, Modal, Portal, Surface, Text, TextInput } from 'react-native-paper';

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
        setMatchMessage('It\'s a match! Check your matches tab.');
      } else {
        setMatchMessage(null);
      }

      setCurrentIndex((prev) => prev + 1);

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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <Text variant="headlineSmall">Discover Activities</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Live activities from your backend.
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
        <HelperText type="error" visible>
          {getErrorMessage(error ?? swipeMutation.error, 'Unable to load activities.')}
        </HelperText>
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
          <Card.Content>
            <Text>No activities match your current filters.</Text>
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

      {currentActivity && (
        <Animated.View style={cardStyle} {...panResponder.panHandlers}>
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium">{currentActivity.title}</Text>
              {!!currentActivity.description && <Text>{currentActivity.description}</Text>}
              {!!currentActivity.location && <Text>📍 {currentActivity.location}</Text>}
              {!!currentActivity.time && <Text>🕒 {new Date(currentActivity.time).toLocaleString()}</Text>}
              <Text>
                👥 {currentActivity.participant_count ?? 0}
                {currentActivity.capacity ? ` / ${currentActivity.capacity}` : ''}
              </Text>
              <Button mode="text" onPress={() => setShowDetails(true)}>
                View details
              </Button>
            </Card.Content>
          </Card>
        </Animated.View>
      )}

      {currentActivity && (
        <View style={styles.actions}>
          <Button mode="outlined" onPress={() => handleSwipe('left')} disabled={isBusy}>
            Swipe left
          </Button>
          <Button mode="contained" onPress={() => handleSwipe('right')} disabled={isBusy}>
            Swipe right
          </Button>
        </View>
      )}

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
  );
};

const styles = StyleSheet.create({
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
  cardContent: {
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
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
});
