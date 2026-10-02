import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { ActionSheet, BlockSheet, ConfirmSheet, ReportSheet } from '@components/foyer/SafetySheets';
import { EmptyState, InlineError, Toast } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { CHAT_COPY, COMMON_COPY, MEMBER_COPY } from '@constants/foyerCopy';
import { canSendMessage, withDividers } from '@foyer/directChat';
import { useSafeInsets } from '@hooks/useSafeInsets';
import { useAuth } from '@hooks/useAuth';
import type { MainStackParamList } from '@navigation/types';
import { fetchConversationMessages, sendConversationMessage } from '@services/chatService';
import {
  blockDirectConversation,
  fetchDirectConversations,
  leaveDirectConversation,
  muteDirectConversation,
  reportDirectConversation,
} from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

type SheetName = 'menu' | 'mute' | 'unmute' | 'report' | 'block' | null;

/** Private chat with a friend. Messages ride on the existing conversation endpoints. */
export const DirectChatScreen = () => {
  const insets = useSafeInsets();
  const route = useRoute<RouteProp<MainStackParamList, 'DirectChat'>>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const conversationId = route.params.conversationId;
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState<SheetName>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const directQuery = useQuery({ queryKey: ['foyer-direct'], queryFn: fetchDirectConversations });
  const conversation = directQuery.data?.find((item) => String(item.id) === String(conversationId));
  const name = conversation?.other_user.first_name ?? route.params.name ?? '';
  const muted = Boolean(conversation?.muted);
  const canSend = conversation ? conversation.can_send : true;

  const messagesQuery = useQuery({
    queryKey: ['foyer-direct-messages', String(conversationId)],
    queryFn: () => fetchConversationMessages(conversationId),
    refetchInterval: 8000,
  });
  const messages = messagesQuery.data ?? [];

  const sendMutation = useMutation({
    mutationFn: (message: string) => sendConversationMessage(conversationId, message),
    onSuccess: async () => {
      setText('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['foyer-direct-messages', String(conversationId)] });
    },
    onError: (sendError) => setError(getErrorMessage(sendError, COMMON_COPY.genericError)),
  });

  const runSheet = async (action: () => Promise<void>, after: () => void) => {
    setPending(true);
    setSheetError(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['foyer-direct'] });
      after();
    } catch (actionError) {
      setSheetError(getErrorMessage(actionError, COMMON_COPY.genericError));
    } finally {
      setPending(false);
    }
  };

  const items = withDividers(messages);
  const sendEnabled = canSendMessage(text, canSend) && !sendMutation.isPending;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]} testID="chat-header">
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.barButton}>
          <Text style={styles.barText}>{COMMON_COPY.back}</Text>
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.barTitle}>
          {muted ? CHAT_COPY.mutedHeader(name) : name}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={() => setSheet('menu')} style={styles.barButton}>
          <MaterialCommunityIcons name="dots-horizontal" size={26} color={appColors.ink} />
        </Pressable>
      </View>
      <View style={styles.banner}>
        <MaterialCommunityIcons name="shield-check-outline" size={18} color={appColors.primary} />
        <Text style={styles.bannerText}>{CHAT_COPY.banner}</Text>
      </View>

      {messages.length === 0 && !messagesQuery.isLoading ? (
        <EmptyState icon="chat-outline" title={CHAT_COPY.emptyTitle} body={CHAT_COPY.emptyBody(name)} />
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
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>{item.message.message}</Text>
              </View>
            );
          }}
        />
      )}
      {messagesQuery.isError ? <InlineError message={CHAT_COPY.loadError} /> : null}
      <InlineError message={error ?? (!canSend ? CHAT_COPY.cannotSend : null)} />

      <View style={[styles.composer, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
        <TextInput
          accessibilityLabel={CHAT_COPY.composerPlaceholder}
          value={text}
          onChangeText={setText}
          placeholder={CHAT_COPY.composerPlaceholder}
          placeholderTextColor={appColors.softInk}
          editable={canSend}
          multiline
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CHAT_COPY.sendLabel}
          accessibilityState={{ disabled: !sendEnabled }}
          disabled={!sendEnabled}
          onPress={() => sendMutation.mutate(text.trim())}
          style={[styles.send, sendEnabled ? styles.sendOn : null]}
        >
          <MaterialCommunityIcons name="arrow-up" size={22} color={sendEnabled ? '#ffffff' : '#7a7572'} />
        </Pressable>
      </View>

      <ActionSheet
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        rows={[
          muted
            ? { label: CHAT_COPY.unmute, sub: CHAT_COPY.unmuteSub(name), onPress: () => setSheet('unmute') }
            : { label: CHAT_COPY.mute, sub: CHAT_COPY.muteSub(name), onPress: () => setSheet('mute') },
          {
            label: CHAT_COPY.leave,
            sub: CHAT_COPY.leaveSub,
            onPress: () => {
              setSheet(null);
              void runSheet(
                () => leaveDirectConversation(conversationId),
                () => navigation.goBack(),
              );
            },
          },
          { label: CHAT_COPY.report, sub: CHAT_COPY.reportSub, onPress: () => setSheet('report') },
          { label: CHAT_COPY.block, sub: CHAT_COPY.blockSub, onPress: () => setSheet('block') },
        ]}
      />
      <ConfirmSheet
        visible={sheet === 'mute'}
        title={CHAT_COPY.muteTitle(name)}
        body={CHAT_COPY.muteBody}
        confirmLabel={CHAT_COPY.muteCta}
        cancelLabel={COMMON_COPY.cancel}
        pending={pending}
        error={sheetError}
        onConfirm={() => void runSheet(() => muteDirectConversation(conversationId, true), () => setSheet(null))}
        onCancel={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={sheet === 'unmute'}
        title={CHAT_COPY.unmuteTitle(name)}
        body={CHAT_COPY.unmuteBody}
        confirmLabel={CHAT_COPY.unmuteCta}
        cancelLabel={COMMON_COPY.cancel}
        pending={pending}
        error={sheetError}
        onConfirm={() => void runSheet(() => muteDirectConversation(conversationId, false), () => setSheet(null))}
        onCancel={() => setSheet(null)}
      />
      <ReportSheet
        visible={sheet === 'report'}
        name={name}
        onClose={() => setSheet(null)}
        onSubmit={(payload) => reportDirectConversation(conversationId, payload)}
        onSent={() => {
          setSheet(null);
          setToast(MEMBER_COPY.reportSent);
        }}
      />
      <BlockSheet
        visible={sheet === 'block'}
        name={name}
        onClose={() => setSheet(null)}
        onConfirm={() => blockDirectConversation(conversationId)}
        onDone={() => {
          setSheet(null);
          void queryClient.invalidateQueries({ queryKey: ['foyer-direct'] });
          void queryClient.invalidateQueries({ queryKey: ['foyer-friends'] });
          navigation.goBack();
        }}
      />
      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  barButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  barText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  barTitle: { flex: 1, textAlign: 'center', fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: appColors.primarySoft, paddingHorizontal: 16, paddingVertical: 10 },
  bannerText: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 13, lineHeight: 18, color: appColors.ink },
  list: { padding: 16, gap: 8 },
  divider: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 12, marginVertical: 6 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: appColors.primary },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: appColors.white },
  bubbleText: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 21, color: appColors.ink },
  bubbleTextMine: { color: '#ffffff' },
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
