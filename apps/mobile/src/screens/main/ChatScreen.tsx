import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { useEffect, useMemo, useRef, useState } from 'react';

import { config } from '@constants/config';
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
} from '@services/chatService';
import { getAccessToken } from '@services/authStorage';
import { getErrorMessage } from '@utils/error';

export const ChatScreen = () => {
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    isRefetching: conversationsRefetching,
    error: conversationsError,
    refetch: refetchConversations,
  } = useQuery({
    queryKey: ['mobile-conversations'],
    queryFn: fetchConversations,
  });

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  const {
    data: messages = [],
    isLoading: messagesLoading,
    isRefetching: messagesRefetching,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['mobile-conversation-messages', selectedConversationId],
    queryFn: () => fetchConversationMessages(selectedConversationId as number),
    enabled: selectedConversationId !== null,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (selectedConversationId === null || !draft.trim()) {
        throw new Error('Message cannot be empty.');
      }
      return sendConversationMessage(selectedConversationId, draft.trim());
    },
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['mobile-conversation-messages', selectedConversationId] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-conversations'] });
    },
  });

  useEffect(() => {
    if (selectedConversationId === null) {
      return;
    }

    let isCancelled = false;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token || isCancelled) {
        return;
      }

      const wsUrl = `${config.websocketUrl}/ws/chat/${selectedConversationId}/?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      websocketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { type?: string; conversationId?: number };
          if (payload.type === 'chat.message' && payload.conversationId === selectedConversationId) {
            void queryClient.invalidateQueries({
              queryKey: ['mobile-conversation-messages', selectedConversationId],
            });
            void queryClient.invalidateQueries({ queryKey: ['mobile-conversations'] });
          }
        } catch {
          // no-op: ignore malformed websocket payloads
        }
      };

      ws.onclose = () => {
        if (isCancelled) {
          return;
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          void connect();
        }, 3000);
      };
    };

    void connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      websocketRef.current?.close();
      websocketRef.current = null;
    };
  }, [queryClient, selectedConversationId]);

  if (selectedConversationId !== null) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Button mode="text" onPress={() => setSelectedConversationId(null)}>
            Back
          </Button>
          <View style={styles.headerTextWrap}>
            <Text variant="titleMedium" style={styles.headerTitle}>
              {selectedConversation?.match ?? 'Conversation'}
            </Text>
            <Text variant="bodySmall" style={styles.subtitleText}>
              Live conversations and messaging.
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {messagesError && (
          <View style={styles.errorContainer}>
            <HelperText type="error" visible>
              {getErrorMessage(messagesError, 'Unable to load messages.')}
            </HelperText>
            <Button mode="outlined" onPress={() => void refetchMessages()} disabled={messagesRefetching}>
              {messagesRefetching ? 'Retrying...' : 'Retry'}
            </Button>
          </View>
        )}

        <FlatList
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          refreshControl={
            <RefreshControl refreshing={messagesRefetching} onRefresh={() => void refetchMessages()} />
          }
          renderItem={({ item }) => (
            <Card style={styles.messageCard}>
              <Card.Content>
                <Text variant="labelSmall">{item.user?.firstName || item.user?.email || 'User'}</Text>
                <Text>{item.message}</Text>
                <Text variant="bodySmall">{new Date(item.createdAt).toLocaleString()}</Text>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={
            messagesLoading ? <Text>Loading messages...</Text> : <Text>No messages yet.</Text>
          }
        />

        {sendMutation.error && (
          <HelperText type="error" visible>
            {getErrorMessage(sendMutation.error, 'Unable to send message.')}
          </HelperText>
        )}

        <View style={styles.composeRow}>
          <TextInput
            mode="outlined"
            placeholder="Type a message"
            value={draft}
            onChangeText={setDraft}
            style={styles.composeInput}
          />
          <Button
            mode="contained"
            onPress={() => sendMutation.mutate()}
            loading={sendMutation.isPending}
            disabled={!draft.trim() || sendMutation.isPending}
          >
            Send
          </Button>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={conversationsRefetching} onRefresh={() => void refetchConversations()} />
      }
      renderItem={({ item }) => {
        const lastMessage = item.messages[item.messages.length - 1];
        return (
          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <Text variant="titleMedium">{item.match}</Text>
              <Text>{lastMessage?.message ?? 'No messages yet.'}</Text>
              <Button mode="text" onPress={() => setSelectedConversationId(item.id)}>
                Open chat
              </Button>
            </Card.Content>
          </Card>
        );
      }}
      ListHeaderComponent={
        <>
          <Text variant="headlineSmall">Chat</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Live conversations and messaging.
          </Text>
          {conversationsError && (
            <View style={styles.errorContainer}>
              <HelperText type="error" visible>
                {getErrorMessage(conversationsError, 'Unable to load conversations.')}
              </HelperText>
              <Button
                mode="outlined"
                onPress={() => void refetchConversations()}
                disabled={conversationsRefetching}
              >
                {conversationsRefetching ? 'Retrying...' : 'Retry'}
              </Button>
            </View>
          )}
          {conversationsLoading && <Text>Loading conversations...</Text>}
        </>
      }
      ListEmptyComponent={
        conversationsLoading ? null : <Text style={styles.emptyText}>No conversations yet.</Text>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  emptyText: {
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    textAlign: 'center',
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerSpacer: {
    width: 56,
  },
  subtitleText: {
    opacity: 0.7,
    textAlign: 'center',
  },
  messageList: {
    paddingVertical: 8,
    gap: 8,
  },
  messageCard: {
    marginBottom: 6,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  composeInput: {
    flex: 1,
  },
  errorContainer: {
    gap: 8,
  },
});
