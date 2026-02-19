import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Card, Chip, HelperText, IconButton, Surface, Text, useTheme } from 'react-native-paper';

import type { MainStackParamList } from '@navigation/types';
import { OfflineBanner } from '@components/OfflineBanner';
import { fetchConversations } from '@services/chatService';
import { fetchMatches } from '@services/matchService';
import { getErrorMessage } from '@utils/error';

export const MatchesScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const theme = useTheme();

  const { data = [], isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['mobile-conversations'],
    queryFn: fetchConversations,
  });

  const conversationByMatchId = new Map<number, number>();
  for (const conversation of conversations) {
    if (typeof conversation.matchId === 'number') {
      conversationByMatchId.set(conversation.matchId, conversation.id);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      <Surface elevation={1} style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="headlineSmall">Matches</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            People who matched with you.
          </Text>
        </View>
      </Surface>

      <OfflineBanner />

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator animating />
          <Text style={styles.secondaryText}>Loading matches...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorContainer}>
          <HelperText type="error" visible>
            {getErrorMessage(error, 'Unable to load matches.')}
          </HelperText>
          <Button mode="outlined" onPress={() => void refetch()} disabled={isRefetching}>
            {isRefetching ? 'Retrying...' : 'Retry'}
          </Button>
        </View>
      ) : null}

      {!isLoading && !error && data.length === 0 ? (
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="message-text-outline" size={56} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium">No matches yet</Text>
          <Text style={styles.secondaryText}>Start swiping to find activities you love!</Text>
        </View>
      ) : null}

      {!isLoading && !error
        ? data.map((match) => {
            const conversationId = conversationByMatchId.get(match.id);
            const title = match.activity || 'Activity';
            const titleInitial = title.trim().slice(0, 1).toUpperCase() || 'A';

            return (
              <Card key={match.id} style={styles.card}>
                <Card.Content>
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.thumb,
                        {
                          backgroundColor: theme.colors.primaryContainer,
                        },
                      ]}
                    >
                      <Text
                        variant="titleLarge"
                        style={{ color: theme.colors.onPrimaryContainer }}
                      >
                        {titleInitial}
                      </Text>
                    </View>

                    <View style={styles.matchText}>
                      <Text variant="titleMedium" numberOfLines={1}>
                        {title}
                      </Text>
                      <Text numberOfLines={1} style={styles.secondaryText}>
                        {match.user_a} ↔ {match.user_b}
                      </Text>
                      <View style={styles.metaRow}>
                        <Chip compact>Matched</Chip>
                        <Text variant="bodySmall" style={styles.secondaryText}>
                          {new Date(match.created_at).toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.trailing}>
                      {conversationId ? (
                        <IconButton
                          icon="message-text"
                          mode="contained"
                          size={22}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            navigation.navigate('Chat', { conversationId });
                          }}
                        />
                      ) : (
                        <IconButton icon="clock-outline" mode="outlined" size={22} disabled />
                      )}
                    </View>
                  </View>
                </Card.Content>
              </Card>
            );
          })
        : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  header: {
    borderRadius: 12,
    padding: 12,
  },
  headerText: {
    gap: 2,
  },
  subtitle: {
    opacity: 0.75,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  card: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 10,
  },
  trailing: {
    alignItems: 'flex-end',
  },
  secondaryText: {
    opacity: 0.7,
  },
  errorContainer: {
    gap: 8,
  },
});
