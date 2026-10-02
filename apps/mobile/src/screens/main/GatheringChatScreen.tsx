import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { EmptyState, InlineError } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, GATHERING_CHAT_COPY } from '@constants/foyerCopy';
import { canSendMessage, withDividers } from '@foyer/directChat';
import { gatheringChatErrorMessage } from '@foyer/gatheringChat';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { fetchActivity } from '@services/activityService';
import { fetchGatheringChatMessages, sendGatheringChatMessage } from '@services/chatService';
import { appColors, appTypography, radii } from '@theme/index';

/**
 * Chat for one gathering, opened by activity id (Gathering "Chat" pill, Gatherings row, push, deep link).
 * Only the host and people who are going can read it; everyone else gets the server's 403.
 * The native header's Back returns to the gathering.
 */
export const GatheringChatScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'GatheringChat'>>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activityId, title: titleParam } = route.params;
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesKey = ['foyer-gathering-chat', String(activityId)];

  // Same key as the gathering screen, so this is usually already cached.
  const activityQuery = useQuery({
    queryKey: ['foyer-gathering', activityId],
    queryFn: () => fetchActivity(activityId),
    enabled: !titleParam,
  });
  const title = titleParam ?? activityQuery.data?.title ?? '';

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: () => fetchGatheringChatMessages(activityId),
    refetchInterval: 8000,
    retry: false,
  });
  const messages = messagesQuery.data ?? [];

  const sendMutation = useMutation({
    mutationFn: (message: string) => sendGatheringChatMessage(activityId, message),
    onSuccess: async () => {
      setText('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: messagesKey });
    },
    onError: (sendError) =>
      setError(gatheringChatErrorMessage(sendError, COMMON_COPY.genericError, GATHERING_CHAT_COPY)),
  });

  const loadError = messagesQuery.isError
    ? gatheringChatErrorMessage(messagesQuery.error, GATHERING_CHAT_COPY.loadError, GATHERING_CHAT_COPY)
    : null;
  // A 403 means the caller is not going/hosting: there is nothing to send to.
  const blocked = messagesQuery.isError;
  const items = withDividers(messages);
  const sendEnabled = canSendMessage(text, !blocked) && !sendMutation.isPending;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {title ? (
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
      ) : null}
      <View style={styles.banner}>
        <MaterialCommunityIcons name="shield-check-outline" size={18} color={appColors.primary} />
        <Text style={styles.bannerText}>{GATHERING_CHAT_COPY.banner}</Text>
      </View>

      {messages.length === 0 && !messagesQuery.isLoading && !messagesQuery.isError ? (
        <EmptyState icon="chat-outline" title={GATHERING_CHAT_COPY.emptyTitle} body={GATHERING_CHAT_COPY.emptyBody} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            if (item.kind === 'divider') {
              return <Text style={styles.divider}>{item.label}</Text>;
            }
            const mine = String(item.message.userId || item.message.user.id) === String(user?.id);
            const sender = item.message.user.firstName;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                {!mine && sender ? <Text style={styles.sender}>{sender}</Text> : null}
                <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>{item.message.message}</Text>
              </View>
            );
          }}
        />
      )}
      <InlineError message={error ?? loadError} />

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={GATHERING_CHAT_COPY.composerPlaceholder}
          value={text}
          onChangeText={setText}
          placeholder={GATHERING_CHAT_COPY.composerPlaceholder}
          placeholderTextColor={appColors.softInk}
          editable={!blocked}
          multiline
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={GATHERING_CHAT_COPY.sendLabel}
          accessibilityState={{ disabled: !sendEnabled }}
          disabled={!sendEnabled}
          onPress={() => sendMutation.mutate(text.trim())}
          style={[styles.send, sendEnabled ? styles.sendOn : null]}
        >
          <MaterialCommunityIcons name="arrow-up" size={22} color={sendEnabled ? '#f6f1ee' : '#7a7572'} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  title: { fontFamily: appTypography.heading, fontSize: 20, lineHeight: 26, color: appColors.ink, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: appColors.primarySoft, paddingHorizontal: 16, paddingVertical: 10 },
  bannerText: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 13, lineHeight: 18, color: appColors.ink },
  list: { padding: 16, gap: 8 },
  divider: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 12, marginVertical: 6 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: appColors.primary },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: appColors.white },
  sender: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.mutedInk, marginBottom: 2 },
  bubbleText: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 21, color: appColors.ink },
  bubbleTextMine: { color: '#f6f1ee' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: 24, backgroundColor: appColors.background },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: appColors.ink,
    fontFamily: appTypography.bodyRegular,
    fontSize: 16,
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e1dbd7', alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: appColors.primary },
});
