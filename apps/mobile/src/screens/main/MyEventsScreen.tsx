import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Card, HelperText, Surface, Text } from 'react-native-paper';

import { fetchHostedActivities } from '@services/activityService';
import { fetchMatches } from '@services/matchService';
import { getErrorMessage } from '@utils/error';

export const MyEventsScreen = () => {
  const {
    data: hosted = [],
    isLoading: hostedLoading,
    isRefetching: hostedRefetching,
    error: hostedError,
    refetch: refetchHosted,
  } = useQuery({
    queryKey: ['mobile-hosted-activities'],
    queryFn: fetchHostedActivities,
  });

  const {
    data: matches = [],
    isLoading: matchesLoading,
    isRefetching: matchesRefetching,
    error: matchesError,
    refetch: refetchMatches,
  } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  const isRefreshing = hostedRefetching || matchesRefetching;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void refetchHosted();
            void refetchMatches();
          }}
        />
      }
    >
      <Text variant="headlineSmall">My Events</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Hosted and matched activity history.
      </Text>

      {(hostedError || matchesError) && (
        <HelperText type="error" visible>
          {getErrorMessage(hostedError ?? matchesError, 'Unable to load your events.')}
        </HelperText>
      )}

      <Card>
        <Card.Title title="Hosted" />
        <Card.Content>
          <Text variant="displaySmall">{hostedLoading ? '…' : hosted.length}</Text>
          <Text>Activities you created</Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Joined/Matched" />
        <Card.Content>
          <Text variant="displaySmall">{matchesLoading ? '…' : matches.length}</Text>
          <Text>Matches from activities</Text>
        </Card.Content>
      </Card>

      <Surface elevation={1} style={styles.listCard}>
        <Text variant="titleMedium">Latest Hosted</Text>
        {hosted.slice(0, 5).map((activity) => (
          <Text key={String(activity.id)}>• {activity.title}</Text>
        ))}
        {!hostedLoading && hosted.length === 0 && <Text>No hosted activities yet.</Text>}
      </Surface>

      <Surface elevation={1} style={styles.listCard}>
        <Text variant="titleMedium">Latest Matched</Text>
        {matches.slice(0, 5).map((match) => (
          <Text key={match.id}>• {match.activity}</Text>
        ))}
        {!matchesLoading && matches.length === 0 && <Text>No matched activities yet.</Text>}
      </Surface>
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
  listCard: {
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
});
