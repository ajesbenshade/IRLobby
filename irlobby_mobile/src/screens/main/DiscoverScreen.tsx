import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text } from 'react-native-paper';

import { fetchActivities, joinActivity, leaveActivity } from '@services/activityService';
import { getErrorMessage } from '@utils/error';

export const DiscoverScreen = () => {
  const queryClient = useQueryClient();

  const {
    data: activities = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['mobile-discover-activities'],
    queryFn: fetchActivities,
  });

  const joinMutation = useMutation({
    mutationFn: joinActivity,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-hosted-activities'] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: leaveActivity,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-hosted-activities'] });
    },
  });

  const isBusy = joinMutation.isPending || leaveMutation.isPending;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <Text variant="headlineSmall">Discover Activities</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Live activities from your backend.
      </Text>

      {isLoading && <Text>Loading activities...</Text>}

      {(error || joinMutation.error || leaveMutation.error) && (
        <HelperText type="error" visible>
          {getErrorMessage(error ?? joinMutation.error ?? leaveMutation.error, 'Unable to load activities.')}
        </HelperText>
      )}

      {!isLoading && activities.length === 0 && (
        <Card>
          <Card.Content>
            <Text>No activities yet.</Text>
          </Card.Content>
        </Card>
      )}

      {activities.map((activity) => (
        <Card key={String(activity.id)} style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">{activity.title}</Text>
            {!!activity.description && <Text>{activity.description}</Text>}
            {!!activity.location && <Text>📍 {activity.location}</Text>}
            {!!activity.time && <Text>🕒 {new Date(activity.time).toLocaleString()}</Text>}
            <Text>
              👥 {activity.participant_count ?? 0}
              {activity.capacity ? ` / ${activity.capacity}` : ''}
            </Text>
            <View style={styles.actions}>
              <Button
                mode="contained"
                onPress={() => joinMutation.mutate(activity.id)}
                loading={joinMutation.isPending && joinMutation.variables === activity.id}
                disabled={isBusy}
              >
                Join
              </Button>
              <Button
                mode="outlined"
                onPress={() => leaveMutation.mutate(activity.id)}
                loading={leaveMutation.isPending && leaveMutation.variables === activity.id}
                disabled={isBusy}
              >
                Leave
              </Button>
            </View>
          </Card.Content>
        </Card>
      ))}
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
});
