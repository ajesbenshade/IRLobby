import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, HelperText, Text } from 'react-native-paper';

import { fetchMatches } from '@services/matchService';
import { getErrorMessage } from '@utils/error';

export const FriendsScreen = () => {
  const { data = [], isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['mobile-friends'],
    queryFn: fetchMatches,
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <Text variant="headlineSmall">Connections</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Your confirmed activity matches appear here.
      </Text>

      {isLoading && <Text>Loading connections...</Text>}

      {error && (
        <View style={styles.errorContainer}>
          <HelperText type="error" visible>
            {getErrorMessage(error, 'Unable to load connections.')}
          </HelperText>
          <Button mode="outlined" onPress={() => void refetch()} disabled={isRefetching}>
            {isRefetching ? 'Retrying...' : 'Retry'}
          </Button>
        </View>
      )}

      {!isLoading && data.length === 0 && (
        <Card>
          <Card.Content>
            <Text>No connections yet.</Text>
          </Card.Content>
        </Card>
      )}

      {data.map((match) => (
        <Card key={match.id} style={styles.card}>
          <Card.Content style={styles.cardContentRow}>
            <View style={styles.identityGroup}>
              <Text variant="titleMedium">{match.user_a}</Text>
              <Text style={styles.secondaryText}>{match.user_b}</Text>
            </View>
            <Chip compact>Matched</Chip>
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
  cardContentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  identityGroup: {
    gap: 6,
    flex: 1,
  },
  secondaryText: {
    opacity: 0.7,
  },
  errorContainer: {
    gap: 8,
  },
});
