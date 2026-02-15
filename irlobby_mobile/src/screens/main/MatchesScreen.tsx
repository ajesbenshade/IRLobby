import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Card, HelperText, Text } from 'react-native-paper';

import { fetchMatches } from '@services/matchService';
import { getErrorMessage } from '@utils/error';

export const MatchesScreen = () => {
  const { data = [], isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <Text variant="headlineSmall">Matches</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Mutual matches from live backend data.
      </Text>

      {isLoading && <Text>Loading matches...</Text>}

      {error && (
        <HelperText type="error" visible>
          {getErrorMessage(error, 'Unable to load matches.')}
        </HelperText>
      )}

      {!isLoading && data.length === 0 && (
        <Card>
          <Card.Content>
            <Text>No matches yet.</Text>
          </Card.Content>
        </Card>
      )}

      {data.map((match) => (
        <Card key={match.id} style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Text variant="titleMedium">{match.activity}</Text>
            <Text>{match.user_a} ↔ {match.user_b}</Text>
            <Text>{new Date(match.created_at).toLocaleString()}</Text>
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
    gap: 6,
  },
});
