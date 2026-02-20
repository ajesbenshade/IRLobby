import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, HelperText, Surface, Text } from 'react-native-paper';

import { fetchConversations } from '@services/chatService';
import { fetchMatches } from '@services/matchService';
import { getErrorMessage } from '@utils/error';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export const NotificationsScreen = () => {
  const { data: matches = [], error: matchesError } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  const { data: conversations = [], error: conversationsError } = useQuery({
    queryKey: ['mobile-conversations'],
    queryFn: fetchConversations,
  });

  const notifications: NotificationItem[] = [
    ...matches.map((match) => ({
      id: `match-${match.id}`,
      title: 'New match confirmed',
      body: `${match.user_a} and ${match.user_b} matched for ${match.activity}.`,
      createdAt: match.created_at,
    })),
    ...conversations
      .map((conversation) => {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (!lastMessage) {
          return null;
        }

        const sender = lastMessage.user?.firstName || lastMessage.user?.email || 'Someone';
        return {
          id: `message-${conversation.id}-${lastMessage.id}`,
          title: `New message in ${conversation.match}`,
          body: `${sender}: ${lastMessage.message}`,
          createdAt: lastMessage.createdAt,
        };
      })
      .filter((item): item is NotificationItem => item !== null),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall">Notifications</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Matches and message updates.
      </Text>

      {(matchesError || conversationsError) && (
        <HelperText type="error" visible>
          {getErrorMessage(matchesError ?? conversationsError, 'Unable to load notifications.')}
        </HelperText>
      )}

      {notifications.length === 0 ? (
        <Card>
          <Card.Content>
            <Text>No notifications yet.</Text>
          </Card.Content>
        </Card>
      ) : (
        notifications.map((item) => (
          <Surface key={item.id} elevation={1} style={styles.itemCard}>
            <Text variant="titleSmall">{item.title}</Text>
            <Text>{item.body}</Text>
            <Text variant="bodySmall">{new Date(item.createdAt).toLocaleString()}</Text>
          </Surface>
        ))
      )}
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
  itemCard: {
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
});
