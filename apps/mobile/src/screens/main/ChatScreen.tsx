import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AccentPill, AppScreenContainer, AppScrollView, EmptyStatePanel, PageHeader, PanelCard } from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { FlatList, RefreshControl, Text as NativeText, View } from '@components/RNCompat';
import { config } from '@constants/config';
import { useAuth } from '@hooks/useAuth';
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
} from '@services/chatService';
import { getAccessToken } from '@services/authStorage';
import { appColors } from '@theme/index';
import { getErrorMessage } from '@utils/error';

export const ChatScreen = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
      <AppScreenContainer style={styles.threadContainer}>
        <View style={styles.threadHeader}>
          <Button mode="text" onPress={() => setSelectedConversationId(null)} compact>
            Back
          </Button>
          <View style={styles.headerTextWrap}>
            <Text variant="titleMedium" style={styles.headerTitle}>
              {selectedConversation?.match ?? 'Conversation'}
            </Text>
            <Text variant="bodySmall" style={styles.subtitleText}>
              Live, low-friction messaging.
            </Text>
          </View>
          <AccentPill tone="secondary">Live</AccentPill>
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
          keyExtractor={(item: (typeof messages)[number]) => String(item.id)}
          contentContainerStyle={styles.messageList}
          style={styles.messageListFrame}
          refreshControl={
            <RefreshControl refreshing={messagesRefetching} onRefresh={() => void refetchMessages()} />
          }
          renderItem={({ item }: { item: (typeof messages)[number] }) => {
            const isOwnMessage = user?.id != null && String(item.userId) === String(user.id);
            return (
              <View style={[styles.messageRow, isOwnMessage ? styles.messageRowOwn : null]}>
                <View style={[styles.messageBubble, isOwnMessage ? styles.messageBubbleOwn : null]}>
                  <Text variant="labelSmall" style={styles.messageAuthor}>
                    {item.user?.firstName || item.user?.email || 'User'}
                  </Text>
                  <Text style={[styles.messageText, isOwnMessage ? styles.messageTextOwn : null]}>{item.message}</Text>
                  <Text variant="bodySmall" style={[styles.messageTimestamp, isOwnMessage ? styles.messageTimestampOwn : null]}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            messagesLoading ? <Text style={styles.loadingText}>Loading messages...</Text> : <Text style={styles.loadingText}>No messages yet.</Text>
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
            buttonColor={appColors.primary}
            style={styles.sendButton}
          >
            Send
          </Button>
        </View>
      </AppScreenContainer>
    );
  }

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={conversationsRefetching} onRefresh={() => void refetchConversations()} />
      }
    >
      <PageHeader
        eyebrow="Messaging"
        title="Chat"
        subtitle="Keep matched conversations moving without the clutter of a generic inbox."
      />

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

      {conversationsLoading && <Text style={styles.loadingText}>Loading conversations...</Text>}

      {!conversationsLoading && conversations.length === 0 ? (
        <EmptyStatePanel
          title="No conversations yet"
          description="Once you match and someone sends the first message, your active threads will appear here."
        />
      ) : null}

      {conversations.map((item) => {
        const lastMessage = item.messages[item.messages.length - 1];
        return (
          <PanelCard key={item.id} style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.cardTopRow}>
                <View style={styles.matchAvatar}>
                  <Text style={styles.matchAvatarText}>{String(item.match).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardTextBlock}>
                  <Text variant="titleMedium" style={styles.cardTitle}>{item.match}</Text>
                  <NativeText style={styles.cardSubtitle} numberOfLines={2}>
                    {lastMessage?.message ?? 'No messages yet.'}
                  </NativeText>
                </View>
                <AccentPill>Open</AccentPill>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.metaText}>{lastMessage ? new Date(lastMessage.createdAt).toLocaleString() : 'Waiting for first message'}</Text>
                <Button mode="text" compact onPress={() => setSelectedConversationId(item.id)}>
                  Open chat
                </Button>
              </View>
            </View>
          </PanelCard>
        );
      })}
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingText: {
    color: appColors.mutedInk,
  },
  card: {
    marginBottom: 0,
  },
  cardContent: {
    gap: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  matchAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ebefff',
  },
  matchAvatarText: {
    color: appColors.primaryDeep,
    fontWeight: '900',
    fontSize: 18,
  },
  cardTextBlock: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: appColors.mutedInk,
    lineHeight: 21,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    paddingTop: 12,
  },
  metaText: {
    color: appColors.softInk,
    fontSize: 12,
  },
  threadContainer: {
    gap: 14,
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: {
    textAlign: 'left',
    color: appColors.ink,
    fontWeight: '800',
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  subtitleText: {
    color: appColors.mutedInk,
  },
  messageListFrame: {
    flex: 1,
  },
  messageList: {
    gap: 10,
    paddingTop: 10,
    paddingBottom: 18,
  },
  messageRow: {
    alignItems: 'flex-start',
  },
  messageRowOwn: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '84%',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: appColors.card,
    borderWidth: 1,
    borderColor: '#e8edf7',
  },
  messageBubbleOwn: {
    backgroundColor: '#e9ecff',
    borderColor: '#d9deff',
  },
  messageAuthor: {
    color: appColors.primaryDeep,
    marginBottom: 6,
  },
  messageText: {
    color: appColors.ink,
    lineHeight: 21,
  },
  messageTextOwn: {
    color: appColors.primaryDeep,
  },
  messageTimestamp: {
    color: appColors.softInk,
    marginTop: 8,
  },
  messageTimestampOwn: {
    color: '#6874d8',
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  composeInput: {
    flex: 1,
    backgroundColor: appColors.card,
  },
  sendButton: {
    borderRadius: 16,
  },
  errorContainer: {
    gap: 8,
  },
});
