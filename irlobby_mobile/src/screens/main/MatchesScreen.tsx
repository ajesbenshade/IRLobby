import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, HelperText, Text } from 'react-native-paper';

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
        People who matched with you.
      </Text>

      {isLoading && <Text>Loading matches...</Text>}

      {error && (
        <View style={styles.errorContainer}>
          <HelperText type="error" visible>
            {getErrorMessage(error, 'Unable to load matches.')}
          </HelperText>
          <Button mode="outlined" onPress={() => void refetch()} disabled={isRefetching}>
            {isRefetching ? 'Retrying...' : 'Retry'}
          </Button>
        </View>
      )}

      {!isLoading && data.length === 0 && (
        <Card>
          <Card.Content>
            <Text>No matches yet.</Text>
            <Text style={styles.secondaryText}>Start swiping to find activities you love.</Text>
          </Card.Content>
        </Card>
      )}

      {data.map((match) => (
        <Card key={match.id} style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.headerRow}>
              <Text variant="titleMedium" style={styles.flexText}>
                {match.activity}
              </Text>
              <Chip compact>Matched</Chip>
            </View>
            <Text>{match.user_a} ↔ {match.user_b}</Text>
            <Text style={styles.secondaryText}>{new Date(match.created_at).toLocaleString()}</Text>
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
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  flexText: {
    flex: 1,
  },
  secondaryText: {
    opacity: 0.7,
  },
  errorContainer: {
    gap: 8,
  },
});
