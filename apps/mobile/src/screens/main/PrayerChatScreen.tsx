import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet } from '@components/foyer/SafetySheets';
import { View } from '@components/RNCompat';
import { formatDividerTime, canSendMessage } from '@foyer/directChat';
import { useAuth } from '@hooks/useAuth';
import { appColors, appTypography, radii } from '@theme/index';
import { PRAYER_COPY, PrayerClientError, prayerChatBanner, prayerChatHeading, type PrayerMessage } from '@shared/prayer';
import type { MainStackParamList } from '@navigation/types';
import { fetchPrayerChat, fetchPrayerRequest, reportPrayerRequest, sendPrayerMessage, stopPraying } from '@services/prayerService';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'PrayerChat'>;

type Row =
  | { kind: 'divider'; key: string; label: string }
  | { kind: 'message'; key: string; message: PrayerMessage };

const withDividers = (messages: PrayerMessage[], now = new Date()): Row[] => {
  const rows: Row[] = [];
  let last: number | null = null;
  for (const message of messages) {
    const at = new Date(message.createdAt).getTime();
    if (last == null || (Number.isFinite(at) && at - last > 30 * 60_000)) {
      rows.push({ kind: 'divider', key: `d-${message.id}`, label: formatDividerTime(message.createdAt, now) });
    }
    rows.push({ kind: 'message', key: `m-${message.id}`, message });
    if (Number.isFinite(at)) last = at;
  }
  return rows;
};

/** Shared prayer chat on the gathering-chat chrome, labeled Prayer chat. No tab bar. */
export const PrayerChatScreen = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<MainStackParamList, 'PrayerChat'>>();
  const { prayerId, title: titleParam } = route.params;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const prayerQuery = useQuery({
    queryKey: ['prayer-request', String(prayerId)],
    queryFn: () => fetchPrayerRequest(prayerId),
    enabled: !titleParam,
    retry: false,
  });
  const messagesKey = ['prayer-chat', String(prayerId)];
  const chatQuery = useQuery({
    queryKey: messagesKey,
    queryFn: () => fetchPrayerChat(prayerId),
    refetchInterval: 8000,
    retry: false,
  });
  const messages = chatQuery.data?.messages ?? [];
  const title = titleParam || chatQuery.data?.prayingFor || prayerQuery.data?.title || '';
  const count = chatQuery.data?.prayingCount || prayerQuery.data?.prayingCount || 0;
  const chatError = chatQuery.isError
    ? chatQuery.error instanceof PrayerClientError
      ? chatQuery.error.message
      : PRAYER_COPY.loadFailed
    : null;
  const send = useMutation({
    mutationFn: (message: string) => sendPrayerMessage(prayerId, message),
    onSuccess: async () => {
      setText('');
      setNotice(null);
      await queryClient.invalidateQueries({ queryKey: messagesKey });
    },
    onError: (error) => setNotice(error instanceof PrayerClientError ? error.message : PRAYER_COPY.sendFailed),
  });
  const sendEnabled = canSendMessage(text, true) && !send.isPending;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.nav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={appColors.primary} />
          </Pressable>
          <View style={styles.navCopy}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.heading}>
              {title ? prayerChatHeading(title) : PRAYER_COPY.chatKind}
            </Text>
            <View style={styles.kindRow}>
              <MaterialCommunityIcons name="triangle-outline" size={14} color={appColors.primary} />
              <Text style={styles.kind}>{PRAYER_COPY.chatKind}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => setMenu(true)} style={styles.iconBtn}>
            <MaterialCommunityIcons name="dots-horizontal" size={24} color={appColors.ink} />
          </Pressable>
        </View>
        <View style={styles.banner}>
          <MaterialCommunityIcons name="triangle-outline" size={18} color={appColors.primary} />
          <Text style={styles.bannerText}>{prayerChatBanner(count)}</Text>
        </View>
        {chatError ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>{chatError}</Text>
          </View>
        ) : messages.length === 0 && !chatQuery.isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{PRAYER_COPY.chatEmpty}</Text>
            <Text style={styles.emptyBody}>{PRAYER_COPY.chatEmptyBody}</Text>
          </View>
        ) : (
          <FlatList
            data={withDividers(messages)}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              if (item.kind === 'divider') return <Text style={styles.divider}>{item.label}</Text>;
              const mine = String(item.message.senderId) === String(user?.id ?? '');
              return (
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine ? <Text style={styles.sender}>{item.message.senderName}</Text> : null}
                  <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>{item.message.body}</Text>
                </View>
              );
            }}
          />
        )}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel={PRAYER_COPY.messagePlaceholder}
            value={text}
            onChangeText={setText}
            placeholder={PRAYER_COPY.messagePlaceholder}
            placeholderTextColor={appColors.softInk}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={PRAYER_COPY.send}
            accessibilityState={{ disabled: !sendEnabled }}
            disabled={!sendEnabled}
            onPress={() => send.mutate(text.trim())}
            style={[styles.send, sendEnabled ? styles.sendOn : null]}
          >
            <MaterialCommunityIcons name="arrow-up" size={22} color={sendEnabled ? appColors.white : '#7a7572'} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        rows={[
          {
            label: PRAYER_COPY.report,
            onPress: () => {
              setMenu(false);
              void reportPrayerRequest(prayerId)
                .then((result) => {
                  setNotice(result === 'sent' ? PRAYER_COPY.reportSent : PRAYER_COPY.reportUnavailable);
                })
                .catch(() => setNotice(PRAYER_COPY.reportUnavailable));
            },
          },
          {
            label: PRAYER_COPY.leave,
            onPress: () => {
              setMenu(false);
              void stopPraying(prayerId)
                .then(() => navigation.goBack())
                .catch((error: unknown) => {
                  setNotice(error instanceof PrayerClientError ? error.message : PRAYER_COPY.stopFailed);
                });
            },
          },
        ]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navCopy: { flex: 1, alignItems: 'center' },
  heading: { fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kind: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 13 },
  banner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#fde8ef',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: { flex: 1, color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 14, lineHeight: 20 },
  list: { padding: 16, gap: 8 },
  divider: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 12, marginVertical: 6 },
  bubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: appColors.primary },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: appColors.white },
  sender: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.mutedInk, marginBottom: 2 },
  bubbleText: { fontFamily: appTypography.bodyRegular, fontSize: 16, lineHeight: 22, color: appColors.ink },
  bubbleTextMine: { color: appColors.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontFamily: appTypography.heading, fontSize: 20, color: appColors.ink },
  emptyBody: { fontFamily: appTypography.bodyRegular, fontSize: 15, color: appColors.mutedInk, textAlign: 'center' },
  notice: { textAlign: 'center', color: appColors.mutedInk, paddingHorizontal: 16, paddingBottom: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: 24 },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.input ?? 24,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 16,
    color: appColors.ink,
    fontSize: 16,
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e1dbd7', alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: appColors.primary },
});
