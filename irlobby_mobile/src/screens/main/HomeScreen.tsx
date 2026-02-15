import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Card, HelperText, Text } from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { fetchActivities, fetchHostedActivities } from '@services/activityService';
import { getErrorMessage } from '@utils/error';

export const HomeScreen = () => {
  const { user } = useAuth();

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
    data: discover = [],
    isLoading: discoverLoading,
    isRefetching: discoverRefetching,
    error: discoverError,
    refetch: refetchDiscover,
  } = useQuery({
    queryKey: ['mobile-discover-activities'],
    queryFn: () => fetchActivities(),
  });

  const isRefreshing = hostedRefetching || discoverRefetching;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void refetchHosted();
            void refetchDiscover();
          }}
        />
      }
    >
      <Text variant="headlineSmall">Welcome {user?.firstName || user?.email || 'back'}</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Your IRLobby snapshot.
      </Text>

      {(hostedError || discoverError) && (
        <HelperText type="error" visible>
          {getErrorMessage(hostedError ?? discoverError, 'Unable to load home data.')}
        </HelperText>
      )}

      <Card>
        <Card.Title title="Hosted activities" />
        <Card.Content>
          <Text variant="displaySmall">{hostedLoading ? '…' : hosted.length}</Text>
          <Text>Activities you created</Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Discoverable activities" />
        <Card.Content>
          <Text variant="displaySmall">{discoverLoading ? '…' : discover.length}</Text>
          <Text>Activities available to join</Text>
        </Card.Content>
      </Card>

      <Card>
        <Card.Title title="Latest hosted" />
        <Card.Content style={styles.listContent}>
          {hosted.slice(0, 3).map((activity) => (
            <Text key={String(activity.id)}>• {activity.title}</Text>
          ))}
          {!hostedLoading && hosted.length === 0 && <Text>No hosted activities yet.</Text>}
        </Card.Content>
      </Card>
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
  listContent: {
    gap: 6,
  },
});
