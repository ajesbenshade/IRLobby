import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AccentPill, AppScreenContainer, AppScrollView, EmptyStatePanel, PageHeader, PanelCard } from '@components/AppChrome';
import { TextInput } from '@components/PaperCompat';
import { FlatList, RefreshControl, Text as NativeText, View } from '@components/RNCompat';
import { config } from '@constants/config';
import { useAuth } from '@hooks/useAuth';
import { fetchMatches } from '@services/matchService';
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
} from '@services/chatService';
import { getAccessToken } from '@services/authStorage';
import { appColors, appTypography } from '@theme/index';
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

  const { data: matches = [] } = useQuery({
    queryKey: ['mobile-matches'],
    queryFn: fetchMatches,
  });

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId),
    [conversations, selectedConversationId],
  );
  const sparkCount = matches.length;
  const activeThreads = conversations.length;
  const freshSparkCount = useMemo(
    () =>
      matches.filter((match) => Date.now() - new Date(match.created_at).getTime() < 1000 * 60 * 60 * 24).length,
    [matches],
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
              {selectedConversation?.match ?? 'Your spark'}
            </Text>
            <Text variant="bodySmall" style={styles.subtitleText}>
              Keep the energy moving while the plan is still warm.
            </Text>
          </View>
          <AccentPill tone="secondary">Live now</AccentPill>
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
            messagesLoading ? <Text style={styles.loadingText}>Loading messages...</Text> : <Text style={styles.loadingText}>No messages yet. Break the ice first.</Text>
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
            placeholder="Keep it light. Make the plan."
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
            Send it
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
        eyebrow="Sparks"
        title="Keep the momentum warm"
        subtitle="Fresh sparks, active chats, and the people most likely to turn into an actual plan all live here."
      />

      <PanelCard style={styles.summaryCard} tone="warm">
        <View style={styles.summaryTopRow}>
          <AccentPill tone="secondary">{sparkCount} sparks</AccentPill>
          <AccentPill tone="neutral">{activeThreads} active chats</AccentPill>
        </View>
        <Text variant="titleMedium" style={styles.summaryTitle}>
          {freshSparkCount > 0
            ? `${freshSparkCount} new spark${freshSparkCount === 1 ? '' : 's'} landed in the last day.`
            : 'Your next spark is one good swipe away.'}
        </Text>
        <Text style={styles.summaryText}>
          Open the chats that already have energy, or head back to Discover when you want to find someone new to talk to.
        </Text>
      </PanelCard>

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

      {conversationsLoading && <Text style={styles.loadingText}>Loading your sparks...</Text>}

      {!conversationsLoading && conversations.length === 0 ? (
        <EmptyStatePanel
          title="No active sparks yet"
          description="Once you match and someone sends the first message, this turns into your running list of people and plans with momentum."
          action={
            <Button mode="contained" buttonColor={appColors.primary} onPress={() => queryClient.invalidateQueries({ queryKey: ['mobile-discover-activities'] })}>
              Check for fresh energy
            </Button>
          }
        />
      ) : null}

      {conversations.map((item) => {
        const lastMessage = item.messages[item.messages.length - 1];
        const matchedRecord = matches.find((match) => match.activity === item.match);
        const isFreshSpark = matchedRecord
          ? Date.now() - new Date(matchedRecord.created_at).getTime() < 1000 * 60 * 60 * 24
          : false;
        return (
          <PanelCard key={item.id} style={styles.card}>
            <View style={styles.cardContent}>
              <View style={styles.cardTopRow}>
                <View style={styles.matchAvatar}>
                  <Text style={styles.matchAvatarText}>{String(item.match).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardTextBlock}>
                  <View style={styles.cardBadgeRow}>
                    <AccentPill tone={isFreshSpark ? 'secondary' : 'neutral'}>
                      {isFreshSpark ? 'Fresh spark' : 'Open chat'}
                    </AccentPill>
                  </View>
                  <Text variant="titleMedium" style={styles.cardTitle}>{item.match}</Text>
                  <NativeText style={styles.cardSubtitle} numberOfLines={2}>
                    {lastMessage?.message ?? 'No messages yet.'}
                  </NativeText>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.metaText}>{lastMessage ? new Date(lastMessage.createdAt).toLocaleString() : 'Waiting for the first move'}</Text>
                <Button mode="text" compact onPress={() => setSelectedConversationId(item.id)}>
                  Jump in
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
  summaryCard: {
    gap: 12,
    backgroundColor: '#fff7df',
    borderColor: '#ffe0a3',
  },
  summaryTopRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryTitle: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
    letterSpacing: -0.5,
  },
  summaryText: {
    color: appColors.mutedInk,
    lineHeight: 21,
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
    backgroundColor: '#ffe3ec',
    borderWidth: 1,
    borderColor: '#ffc6d7',
  },
  matchAvatarText: {
    color: appColors.primaryDeep,
    fontFamily: appTypography.headingDisplay,
    fontSize: 18,
  },
  cardTextBlock: {
    flex: 1,
    gap: 4,
  },
  cardBadgeRow: {
    marginBottom: 2,
  },
  cardTitle: {
    color: appColors.ink,
    fontFamily: appTypography.heading,
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
    borderTopColor: '#f3e2ea',
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
    fontFamily: appTypography.heading,
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
    borderColor: '#f0dfe7',
  },
  messageBubbleOwn: {
    backgroundColor: '#ffe7f0',
    borderColor: '#ffc9da',
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
    borderRadius: 999,
  },
  errorContainer: {
    gap: 8,
  },
});
