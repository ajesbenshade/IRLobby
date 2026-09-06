import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AccentPill, AppScreenContainer, AppScrollView, EmptyStatePanel, PageHeader, PanelCard } from '@components/AppChrome';
import { IrlobbyWordmark } from '@components/IrlobbyWordmark';
import { SafetyActionsModal } from '@components/SafetyActionsModal';
import { FlatList, KeyboardAvoidingView, RefreshControl, Text as NativeText, View } from '@components/RNCompat';
import { AppButton } from '@components/ui/Button';
import { config } from '@constants/config';
import { useAuth } from '@hooks/useAuth';
import type { MainTabParamList } from '@navigation/types';
import { fetchMatches } from '@services/matchService';
import {
  fetchConversationMessages,
  fetchConversations,
  sendConversationMessage,
} from '@services/chatService';
import { getAccessToken } from '@services/authStorage';
import { appColors, appTypography } from '@theme/index';
import { getErrorMessage } from '@utils/error';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

const getConversationMessages = (conversation: { messages?: unknown } | null | undefined) => (
  Array.isArray(conversation?.messages) ? conversation.messages : []
);

const TYPING_IDLE_MS = 1800;
const TYPING_REFRESH_MS = 1200;

type ChatSocketPayload = {
  type?: string;
  conversationId?: number;
  userId?: number | string;
  isOnline?: boolean;
  isTyping?: boolean;
  users?: Array<{ userId?: number | string; isOnline?: boolean }>;
};

export const ChatScreen = () => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [safetyUserId, setSafetyUserId] = useState<number | string | null>(null);
  const [safetyUserLabel, setSafetyUserLabel] = useState<string | undefined>(undefined);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(() => new Set());
  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingExpiryTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingSentAtRef = useRef(0);

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

  const conversationItems = Array.isArray(conversations) ? conversations : [];
  const matchItems = Array.isArray(matches) ? matches : [];
  const selectedConversation = useMemo(
    () => conversationItems.find((item) => item.id === selectedConversationId),
    [conversationItems, selectedConversationId],
  );
  const sparkCount = matchItems.length;
  const activeThreads = conversationItems.length;
  const currentUserId = user?.id == null ? null : String(user.id);
  const otherOnlineCount = useMemo(
    () => Array.from(onlineUserIds).filter((id) => id !== currentUserId).length,
    [currentUserId, onlineUserIds],
  );
  const otherTypingCount = useMemo(
    () => Array.from(typingUserIds).filter((id) => id !== currentUserId).length,
    [currentUserId, typingUserIds],
  );
  const freshSparkCount = useMemo(
    () =>
      matchItems.filter((match) => Date.now() - new Date(match.created_at).getTime() < 1000 * 60 * 60 * 24).length,
    [matchItems],
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

  const clearTypingExpiryTimers = useCallback(() => {
    typingExpiryTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    typingExpiryTimeoutsRef.current.clear();
  }, []);

  const sendTypingEvent = useCallback((isTyping: boolean) => {
    const socket = websocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify({ type: 'typing', isTyping }));
  }, []);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (selectedConversationId === null || !draft.trim()) {
        throw new Error('Message cannot be empty.');
      }
      return sendConversationMessage(selectedConversationId, draft.trim());
    },
    onSuccess: async () => {
      sendTypingEvent(false);
      lastTypingSentAtRef.current = 0;
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['mobile-conversation-messages', selectedConversationId] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-conversations'] });
    },
  });

  const stopTypingSoon = useCallback(() => {
    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = setTimeout(() => {
      sendTypingEvent(false);
    }, TYPING_IDLE_MS);
  }, [sendTypingEvent]);

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);

      if (!value.trim()) {
        if (typingStopTimeoutRef.current) {
          clearTimeout(typingStopTimeoutRef.current);
        }
        sendTypingEvent(false);
        lastTypingSentAtRef.current = 0;
        return;
      }

      const now = Date.now();
      if (now - lastTypingSentAtRef.current > TYPING_REFRESH_MS) {
        sendTypingEvent(true);
        lastTypingSentAtRef.current = now;
      }
      stopTypingSoon();
    },
    [sendTypingEvent, stopTypingSoon],
  );

  const applyTypingUpdate = useCallback(
    (userId: number | string | undefined, isTyping: boolean | undefined) => {
      if (userId == null) {
        return;
      }

      const id = String(userId);
      if (id === currentUserId) {
        return;
      }

      const existingTimeout = typingExpiryTimeoutsRef.current.get(id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        typingExpiryTimeoutsRef.current.delete(id);
      }

      setTypingUserIds((previous) => {
        const next = new Set(previous);
        if (isTyping) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });

      if (isTyping) {
        const timeout = setTimeout(() => {
          setTypingUserIds((previous) => {
            const next = new Set(previous);
            next.delete(id);
            return next;
          });
          typingExpiryTimeoutsRef.current.delete(id);
        }, TYPING_IDLE_MS + 1200);
        typingExpiryTimeoutsRef.current.set(id, timeout);
      }
    },
    [currentUserId],
  );

  const applyPresencePayload = useCallback(
    (payload: ChatSocketPayload) => {
      if (payload.type === 'chat.presence_snapshot') {
        setOnlineUserIds(
          new Set(
            (payload.users ?? [])
              .filter((item) => item.userId != null && item.isOnline)
              .map((item) => String(item.userId)),
          ),
        );
        return;
      }

      if (payload.userId == null) {
        return;
      }

      setOnlineUserIds((previous) => {
        const next = new Set(previous);
        const id = String(payload.userId);
        if (payload.isOnline) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    },
    [],
  );

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
          const payload = JSON.parse(event.data) as ChatSocketPayload;
          if (payload.conversationId != null && payload.conversationId !== selectedConversationId) {
            return;
          }

          if (payload.type === 'chat.message' && payload.conversationId === selectedConversationId) {
            void queryClient.invalidateQueries({
              queryKey: ['mobile-conversation-messages', selectedConversationId],
            });
            void queryClient.invalidateQueries({ queryKey: ['mobile-conversations'] });
            applyTypingUpdate(payload.userId, false);
            return;
          }

          if (payload.type === 'chat.presence' || payload.type === 'chat.presence_snapshot') {
            applyPresencePayload(payload);
            return;
          }

          if (payload.type === 'chat.typing') {
            applyTypingUpdate(payload.userId, payload.isTyping);
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
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
      }
      sendTypingEvent(false);
      lastTypingSentAtRef.current = 0;
      clearTypingExpiryTimers();
      websocketRef.current?.close();
      websocketRef.current = null;
      setOnlineUserIds(new Set());
      setTypingUserIds(new Set());
    };
  }, [applyPresencePayload, applyTypingUpdate, clearTypingExpiryTimers, queryClient, selectedConversationId, sendTypingEvent]);

  if (selectedConversationId !== null) {
    return (
      <KeyboardAvoidingView style={styles.threadFlex} behavior="padding">
      <AppScreenContainer style={styles.threadContainer}>
        <View style={styles.threadHeader}>
          <AppButton variant="ghost" compact onPress={() => setSelectedConversationId(null)}>
            Back
          </AppButton>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>
              {selectedConversation?.match ?? 'Your spark'}
            </Text>
            <Text style={styles.subtitleText}>
              {otherTypingCount > 0
                ? 'Typing...'
                : otherOnlineCount > 0
                  ? 'Online now'
                  : 'Keep the plan moving'}
            </Text>
          </View>
          <AppButton
            variant="ghost"
            compact
            disabled={!selectedConversation?.otherUserId}
            onPress={() => {
              setSafetyUserId(selectedConversation?.otherUserId ?? null);
              setSafetyUserLabel(selectedConversation?.match);
            }}
          >
            Safety
          </AppButton>
        </View>

        {messagesError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {getErrorMessage(messagesError, 'Unable to load messages.')}
            </Text>
            <AppButton variant="outline" onPress={() => void refetchMessages()} disabled={messagesRefetching}>
              {messagesRefetching ? 'Retrying...' : 'Retry'}
            </AppButton>
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
                  {!isOwnMessage ? (
                    <Text style={styles.messageAuthor}>
                      {item.user?.firstName || 'Them'}
                    </Text>
                  ) : null}
                  <Text style={[styles.messageText, isOwnMessage ? styles.messageTextOwn : null]}>{item.message}</Text>
                  <Text style={[styles.messageTimestamp, isOwnMessage ? styles.messageTimestampOwn : null]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            messagesLoading ? <Text style={styles.loadingText}>Loading messages...</Text> : <Text style={styles.loadingText}>No messages yet. Break the ice first.</Text>
          }
          ListFooterComponent={
            otherTypingCount > 0 ? (
              <View style={styles.typingIndicator}>
                <Text style={styles.typingIndicatorText}>Typing...</Text>
              </View>
            ) : null
          }
        />

        {sendMutation.error ? (
          <Text style={styles.errorText}>
            {getErrorMessage(sendMutation.error, 'Unable to send message.')}
          </Text>
        ) : null}

        <View style={styles.composeRow}>
          <TextInput
            placeholder="Keep it light. Make the plan."
            placeholderTextColor={appColors.softInk}
            value={draft}
            onChangeText={handleDraftChange}
            style={styles.composeInput}
            multiline
          />
          <AppButton
            onPress={() => void sendMutation.mutate()}
            loading={sendMutation.isPending}
            disabled={!draft.trim() || sendMutation.isPending}
            compact
            style={styles.sendButton}
          >
            Send
          </AppButton>
        </View>

        <SafetyActionsModal
          visible={safetyUserId != null}
          userId={safetyUserId}
          userLabel={safetyUserLabel}
          onClose={() => {
            setSafetyUserId(null);
            setSafetyUserLabel(undefined);
          }}
          onBlocked={() => {
            setSelectedConversationId(null);
            void queryClient.invalidateQueries({ queryKey: ['mobile-conversations'] });
            void queryClient.invalidateQueries({ queryKey: ['mobile-matches'] });
          }}
        />
      </AppScreenContainer>
      </KeyboardAvoidingView>
    );
  }

  return (
    <>
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={conversationsRefetching} onRefresh={() => void refetchConversations()} />
      }
    >
      <PageHeader
        eyebrow="Chat"
        title="Your conversations"
        subtitle="New matches and active chats live here."
        rightContent={<IrlobbyWordmark size="sm" />}
      />

      <PanelCard style={styles.summaryCard} tone="warm">
        <View style={styles.summaryTopRow}>
          <AccentPill tone="secondary">{sparkCount} new</AccentPill>
          <AccentPill tone="neutral">{activeThreads} active</AccentPill>
        </View>
        <Text style={styles.summaryTitle}>
          {freshSparkCount > 0
            ? `${freshSparkCount} new match${freshSparkCount === 1 ? '' : 'es'} today.`
            : 'Match with someone to start a chat.'}
        </Text>
        <Text style={styles.summaryText}>
          Reply to the chats with momentum, or head back to Discover.
        </Text>
      </PanelCard>

      {conversationsError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {getErrorMessage(conversationsError, 'Unable to load conversations.')}
          </Text>
          <AppButton
            variant="outline"
            onPress={() => void refetchConversations()}
            disabled={conversationsRefetching}
          >
            {conversationsRefetching ? 'Retrying...' : 'Retry'}
          </AppButton>
        </View>
      )}

      {conversationsLoading && <Text style={styles.loadingText}>Loading your chats…</Text>}

      {!conversationsLoading && !conversationsError && conversationItems.length === 0 ? (
        <EmptyStatePanel
          title="No chats yet"
          description="Match on a plan first — then message here to lock in the details."
          action={
            <AppButton onPress={() => navigation.navigate('Discover')}>
              Find a plan
            </AppButton>
          }
        />
      ) : null}

      {conversationItems.map((item) => {
        const conversationMessages = getConversationMessages(item);
        const lastMessage = conversationMessages[conversationMessages.length - 1] as
          | { message?: string; createdAt?: string }
          | undefined;
        const matchedRecord = matchItems.find((match) => match.activity === item.match);
        const isFreshSpark = matchedRecord
          ? Date.now() - new Date(matchedRecord.created_at).getTime() < 1000 * 60 * 60 * 24
          : false;
        return (
          <Pressable key={item.id} onPress={() => setSelectedConversationId(item.id)}>
            <PanelCard style={styles.card}>
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
                    <Text style={styles.cardTitle}>{item.match}</Text>
                    <NativeText style={styles.cardSubtitle} numberOfLines={2}>
                      {lastMessage?.message ?? 'No messages yet.'}
                    </NativeText>
                  </View>
                </View>
                <Text style={styles.metaText}>
                  {lastMessage?.createdAt
                    ? new Date(lastMessage.createdAt).toLocaleString()
                    : 'Waiting for the first move'}
                </Text>
              </View>
            </PanelCard>
          </Pressable>
        );
      })}
    </AppScrollView>
    <SafetyActionsModal
      visible={safetyUserId != null}
      userId={safetyUserId}
      userLabel={safetyUserLabel}
      onClose={() => {
        setSafetyUserId(null);
        setSafetyUserLabel(undefined);
      }}
      onBlocked={() => {
        void queryClient.invalidateQueries({ queryKey: ['mobile-conversations'] });
        void queryClient.invalidateQueries({ queryKey: ['mobile-matches'] });
      }}
    />
    </>
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
    backgroundColor: 'rgba(232, 200, 114, 0.12)',
    borderColor: 'rgba(232, 200, 114, 0.28)',
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
    backgroundColor: 'rgba(192, 38, 211, 0.16)',
    borderWidth: 1,
    borderColor: appColors.line,
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
    borderTopColor: appColors.line,
    paddingTop: 12,
  },
  metaText: {
    color: appColors.softInk,
    fontSize: 12,
  },
  threadFlex: {
    flex: 1,
  },
  threadContainer: {
    gap: 14,
    flex: 1,
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
    borderColor: appColors.line,
  },
  messageBubbleOwn: {
    backgroundColor: appColors.primaryWash,
    borderColor: appColors.primaryWashStrong,
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
    color: appColors.primaryGlow,
  },
  typingIndicator: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(232, 200, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 200, 114, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  typingIndicatorText: {
    color: appColors.mutedInk,
    fontSize: 12,
    fontWeight: '700',
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.line,
  },
  composeInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: appColors.cardStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    color: appColors.ink,
    fontSize: 16,
  },
  sendButton: {
    minWidth: 72,
  },
  errorContainer: {
    gap: 8,
  },
  errorText: {
    color: appColors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
