import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, HelperText, Surface, Text, useTheme } from 'react-native-paper';

import type { MainStackParamList } from '@navigation/types';
import { fetchConversations } from '@services/chatService';
import { fetchMatches } from '@services/matchService';
import { getErrorMessage } from '@utils/error';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  action?:
    | { type: 'openMatches' }
    | { type: 'openChat'; conversationId: number; matchId?: number };
}

export const NotificationsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const theme = useTheme();

  const { data: matches = [], error: matchesError } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  const {
    data: conversations = [],
    error: conversationsError,
    isLoading: conversationsLoading,
  } = useQuery({
    queryKey: ['mobile-conversations'],
    queryFn: fetchConversations,
  });

  const isLoading = conversationsLoading && matches.length === 0;

  const notifications: NotificationItem[] = [
    ...matches.map((match) => ({
      id: `match-${match.id}`,
      title: 'New match confirmed',
      body: `${match.user_a} and ${match.user_b} matched for ${match.activity}.`,
      createdAt: match.created_at,
      action: { type: 'openMatches' },
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
          action: {
            type: 'openChat',
            conversationId: conversation.id,
            matchId: conversation.matchId,
          },
        };
      })
      .filter((item): item is NotificationItem => item !== null),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const onPressNotification = (item: NotificationItem) => {
    if (!item.action) {
      return;
    }

    void Haptics.selectionAsync();

    if (item.action.type === 'openMatches') {
      navigation.navigate('Tabs', { screen: 'Matches' });
      return;
    }

    navigation.navigate('Chat', {
      conversationId: item.action.conversationId,
      matchId: item.action.matchId,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall">Notifications</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Matches and message updates.
      </Text>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator animating />
          <Text style={styles.secondaryText}>Loading notifications...</Text>
        </View>
      ) : null}

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
          <Pressable
            key={item.id}
            onPress={() => onPressNotification(item)}
            disabled={!item.action}
            style={({ pressed }) => [pressed && item.action ? styles.pressed : null]}
          >
            <Surface
              elevation={1}
              style={[
                styles.itemCard,
                !item.action ? { opacity: 0.75 } : null,
                { backgroundColor: theme.colors.elevation.level1 },
              ]}
            >
              <Text variant="titleSmall">{item.title}</Text>
              <Text>{item.body}</Text>
              <Text variant="bodySmall" style={styles.secondaryText}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </Surface>
          </Pressable>
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
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  secondaryText: {
    opacity: 0.7,
  },
  itemCard: {
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  pressed: {
    opacity: 0.85,
  },
});
