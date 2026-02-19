import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, IconButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { useEffect, useMemo, useRef, useState } from 'react';

import { config } from '@constants/config';
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
  type ConversationItem,
  type ConversationMessage,
} from '@services/chatService';
import { getAccessToken } from '@services/authStorage';
import { getErrorMessage } from '@utils/error';

import { useAuth } from '@hooks/useAuth';

import type { MainStackParamList } from '@navigation/types';

export const ChatScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'Chat'>>();
  const theme = useTheme();
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(
    typeof route.params?.conversationId === 'number' ? route.params.conversationId : null,
  );
  const [draft, setDraft] = useState('');
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    isRefetching: conversationsRefetching,
    error: conversationsError,
    refetch: refetchConversations,
  } = useQuery<ConversationItem[]>({
    queryKey: ['mobile-conversations'],
    queryFn: fetchConversations,
  });

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  useEffect(() => {
    if (selectedConversationId !== null) {
      return;
    }

    const matchId = route.params?.matchId;
    if (typeof matchId !== 'number') {
      return;
    }

    const resolved = conversations.find((conversation) => conversation.matchId === matchId);
    if (resolved) {
      setSelectedConversationId(resolved.id);
    }
  }, [conversations, route.params?.matchId, selectedConversationId]);

  const {
    data: messages = [],
    isLoading: messagesLoading,
    isRefetching: messagesRefetching,
    error: messagesError,
    refetch: refetchMessages,
  } = useQuery<ConversationMessage[]>({
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
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
            void Haptics.selectionAsync();
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
    const shouldPopOnBack =
      typeof route.params?.conversationId === 'number' || typeof route.params?.matchId === 'number';

    return (
      <View style={styles.container}>
        <Surface elevation={1} style={styles.header}>
          <View style={styles.headerRow}>
            <IconButton
              icon="arrow-left"
              onPress={() => {
                void Haptics.selectionAsync();
                if (shouldPopOnBack && navigation.canGoBack()) {
                  navigation.goBack();
                  return;
                }

                setSelectedConversationId(null);
              }}
            />
            <View style={styles.headerTextWrap}>
              <Text variant="titleMedium" numberOfLines={1}>
                {selectedConversation?.match ?? 'Conversation'}
              </Text>
              <Text variant="bodySmall" style={styles.subtitleText}>
                Live conversations and messaging.
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </Surface>

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

        <FlatList<ConversationMessage>
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          refreshControl={
            <RefreshControl refreshing={messagesRefetching} onRefresh={() => void refetchMessages()} />
          }
          renderItem={({ item }) => {
            const isSelf = user?.id != null && String(item.userId) === String(user.id);

            return (
              <View style={[styles.bubbleRow, isSelf ? styles.bubbleRowSelf : styles.bubbleRowOther]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isSelf ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  <Text variant="labelSmall" style={styles.bubbleSender}>
                    {item.user?.firstName || item.user?.email || (isSelf ? 'You' : 'User')}
                  </Text>
                  <Text>{item.message}</Text>
                  <Text variant="bodySmall" style={styles.bubbleMeta}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            messagesLoading ? (
              <View style={styles.centerState}>
                <ActivityIndicator animating />
                <Text style={styles.secondaryText}>Loading messages...</Text>
              </View>
            ) : (
              <View style={styles.centerState}>
                <Text variant="titleMedium">No messages yet</Text>
                <Text style={styles.secondaryText}>Say hi to start the conversation.</Text>
              </View>
            )
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
          <IconButton
            icon="send"
            mode="contained"
            disabled={!draft.trim() || sendMutation.isPending}
            onPress={() => {
              void Haptics.selectionAsync();
              sendMutation.mutate();
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <FlatList<ConversationItem>
      data={conversations}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={conversationsRefetching} onRefresh={() => void refetchConversations()} />
      }
      renderItem={({ item }) => {
        const lastMessage = item.messages[item.messages.length - 1];
        return (
          <Surface style={styles.conversationRow} elevation={1}>
            <View style={styles.conversationText}>
              <Text variant="titleMedium" numberOfLines={1}>
                {item.match}
              </Text>
              <Text numberOfLines={1} style={styles.secondaryText}>
                {lastMessage?.message ?? 'No messages yet.'}
              </Text>
            </View>
            <IconButton
              icon="message-text"
              mode="contained"
              size={22}
              onPress={() => {
                void Haptics.selectionAsync();
                setSelectedConversationId(item.id);
              }}
            />
          </Surface>
        );
      }}
      ListHeaderComponent={
        <>
          <Surface elevation={1} style={styles.header}>
            <Text variant="headlineSmall">Chat</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Live conversations and messaging.
            </Text>
          </Surface>
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
          {conversationsLoading && (
            <View style={styles.centerState}>
              <ActivityIndicator animating />
              <Text style={styles.secondaryText}>Loading conversations...</Text>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        conversationsLoading ? null : (
          <View style={styles.centerState}>
            <Text variant="titleMedium">No conversations yet</Text>
            <Text style={styles.secondaryText}>Open a match to start chatting.</Text>
          </View>
        )
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
  header: {
    borderRadius: 12,
    padding: 12,
  },
  subtitle: {
    opacity: 0.75,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  messageList: {
    paddingVertical: 8,
    gap: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  bubbleRowSelf: {
    justifyContent: 'flex-end',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  bubbleSender: {
    opacity: 0.7,
  },
  bubbleMeta: {
    opacity: 0.6,
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
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  secondaryText: {
    opacity: 0.7,
  },
  conversationRow: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  conversationText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  errorContainer: {
    gap: 8,
  },
});
