import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RefreshControl, ScrollView, View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import {
  CIRCLE_COPY,
  CircleClientError,
  directoryChip,
  directoryEmptyCopy,
  inviteLine,
  memberCountLabel,
} from '@shared/circles';
import type { MainStackParamList } from '@navigation/types';
import { acceptCircleInvite, declineCircleInvite, fetchCircles, fetchInviteInbox } from '@services/circleService';

import { useDebounced } from './useDebounced';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'Circles'>;

export const CirclesScreen = () => {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const debounced = useDebounced(query);
  const circles = useQuery({
    queryKey: ['circles', debounced],
    queryFn: () => fetchCircles(debounced),
    retry: false,
  });
  const inbox = useQuery({
    queryKey: ['circle-invites'],
    queryFn: fetchInviteInbox,
    retry: false,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['circles'] });
    await queryClient.invalidateQueries({ queryKey: ['circle-invites'] });
    await queryClient.invalidateQueries({ queryKey: ['prayer-circles'] });
  };

  const respond = useMutation({
    mutationFn: async (input: { id: number | string; accept: boolean }) => {
      if (input.accept) await acceptCircleInvite(input.id);
      else await declineCircleInvite(input.id);
    },
    onSuccess: refresh,
    onError: (error) => setNotice(error instanceof CircleClientError ? error.message : CIRCLE_COPY.saveFailed),
  });

  const rows = circles.data ?? [];
  const empty = !circles.isLoading && !circles.isError ? directoryEmptyCopy(debounced, rows.length) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={appColors.primary} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {CIRCLE_COPY.directoryTitle}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CIRCLE_COPY.createTitle}
          onPress={() => navigation.navigate('CircleCreate')}
          style={styles.plus}
          testID="circles-create"
        >
          <MaterialCommunityIcons name="plus" size={26} color={appColors.white} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={circles.isRefetching} onRefresh={() => void circles.refetch()} />}
      >
        <TextInput
          accessibilityLabel={CIRCLE_COPY.searchPlaceholder}
          value={query}
          onChangeText={setQuery}
          placeholder={CIRCLE_COPY.searchPlaceholder}
          placeholderTextColor={appColors.softInk}
          style={styles.search}
          autoCorrect={false}
        />
        {notice ? <Text style={styles.error}>{notice}</Text> : null}
        {(inbox.data ?? []).map((invite) => (
          <View key={String(invite.id)} style={[styles.card, styles.inviteCard]}>
            <Text style={styles.inviteCopy}>{inviteLine(invite.inviter?.name ?? '', invite.circleName)}</Text>
            <View style={styles.inviteActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => respond.mutate({ id: invite.id, accept: true })}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>{CIRCLE_COPY.accept}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => respond.mutate({ id: invite.id, accept: false })}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>{CIRCLE_COPY.decline}</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {circles.isError ? <Text style={styles.error}>{CIRCLE_COPY.loadFailed}</Text> : null}
        {empty ? <Text style={styles.empty}>{empty}</Text> : null}
        {rows.map((circle) => {
          const chip = directoryChip(circle);
          return (
            <Pressable
              key={String(circle.id)}
              accessibilityRole="button"
              onPress={() => navigation.navigate('CircleDetail', { circleId: circle.id })}
              style={styles.card}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.name}>{circle.name}</Text>
                <Text style={styles.meta}>{memberCountLabel(circle.memberCount)}</Text>
              </View>
              {chip ? (
                <Text style={styles.chip}>{chip}</Text>
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 56, gap: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: appTypography.heading, fontSize: 34, lineHeight: 40, color: appColors.ink, fontWeight: '700' },
  plus: { width: 48, height: 48, borderRadius: 24, backgroundColor: appColors.primary, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  search: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    fontFamily: appTypography.bodyRegular,
    fontSize: 16,
    color: appColors.ink,
  },
  card: {
    backgroundColor: appColors.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowCopy: { flex: 1, gap: 4 },
  name: { fontFamily: appTypography.heading, fontSize: 20, lineHeight: 26, color: appColors.ink, fontWeight: '700' },
  meta: { fontFamily: appTypography.bodyRegular, fontSize: 15, color: appColors.mutedInk },
  chip: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#f9e8ee',
    color: appColors.primary,
    fontFamily: appTypography.bodySemibold,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inviteCard: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  inviteCopy: { fontFamily: appTypography.bodyRegular, fontSize: 16, lineHeight: 22, color: appColors.ink },
  inviteActions: { flexDirection: 'row', gap: 8 },
  primary: { minHeight: 40, borderRadius: 999, backgroundColor: appColors.primary, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: appColors.white, fontFamily: appTypography.bodySemibold, fontSize: 15 },
  secondary: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: appColors.line, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: appColors.ink, fontFamily: appTypography.bodySemibold, fontSize: 15 },
  empty: { marginTop: 28, textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 16, lineHeight: 22 },
  error: { color: appColors.danger, fontFamily: appTypography.bodyRegular, fontSize: 15 },
});
