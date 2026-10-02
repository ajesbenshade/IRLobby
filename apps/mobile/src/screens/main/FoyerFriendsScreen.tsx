import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';

import { AppScrollView } from '@components/AppChrome';
import { Avatar, EmptyState, InlineError, PillButton, SectionLabel } from '@components/foyer/ui';
import { RefreshControl, View } from '@components/RNCompat';
import { COMMON_COPY, FRIEND_COPY } from '@constants/foyerCopy';
import { filterFriends, initialsFor } from '@foyer/friends';
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchFriends,
  removeFriend,
  type FriendRequestItem,
} from '@services/foyerService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

export const FRIENDS_KEY = ['foyer-friends'] as const;
export const REQUESTS_KEY = ['foyer-friend-requests'] as const;

/** Profile > Friends: `Friends (n)` and `Requests (n)` tabs. */
export const FoyerFriendsScreen = () => {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const friendsQuery = useQuery({ queryKey: FRIENDS_KEY, queryFn: fetchFriends });
  const requestsQuery = useQuery({ queryKey: REQUESTS_KEY, queryFn: fetchFriendRequests });
  const friends = friendsQuery.data ?? [];
  const incoming = requestsQuery.data?.incoming ?? [];
  const outgoing = requestsQuery.data?.outgoing ?? [];
  const requestCount = incoming.length + outgoing.length;
  const shownFriends = filterFriends(friends, query);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: FRIENDS_KEY }),
      queryClient.invalidateQueries({ queryKey: REQUESTS_KEY }),
    ]);
  };

  const act = useMutation({
    mutationFn: async (input: { id: number; run: () => Promise<void> }) => {
      setBusyId(input.id);
      await input.run();
    },
    onSuccess: async () => {
      setError(null);
      await refreshAll();
    },
    onError: (actionError) => setError(getErrorMessage(actionError, COMMON_COPY.genericError)),
    onSettled: () => setBusyId(null),
  });

  const openProfile = (userId: number) => navigation.navigate('MemberProfile', { userId });

  const loadError = friendsQuery.error ?? requestsQuery.error;

  const requestRow = (item: FriendRequestItem) => {
    const isIncoming = item.direction === 'incoming';
    const busy = busyId === item.id && act.isPending;
    return (
      <View key={item.id} style={styles.requestRow}>
        <Pressable accessibilityRole="button" onPress={() => openProfile(item.user.id)} style={styles.requestWho}>
          <Avatar initials={initialsFor(item.user.first_name)} size={44} />
          <View style={styles.flex}>
            <Text style={styles.name}>{item.user.first_name}</Text>
            {isIncoming ? <Text style={styles.sub}>{FRIEND_COPY.wantsToBeFriends(item.user.first_name)}</Text> : null}
          </View>
        </Pressable>
        {isIncoming ? (
          <View style={styles.requestButtons}>
            <PillButton
              label={FRIEND_COPY.accept}
              disabled={busy}
              style={styles.smallPill}
              onPress={() => act.mutate({ id: item.id, run: () => acceptFriendRequest(item.id) })}
            />
            <PillButton
              label={FRIEND_COPY.decline}
              variant="outline"
              disabled={busy}
              style={styles.smallPill}
              onPress={() => act.mutate({ id: item.id, run: () => declineFriendRequest(item.id) })}
            />
          </View>
        ) : (
          <PillButton
            label={FRIEND_COPY.cancelRequest}
            variant="text"
            disabled={busy}
            onPress={() => act.mutate({ id: item.id, run: () => removeFriend(item.user.id) })}
          />
        )}
      </View>
    );
  };

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={friendsQuery.isRefetching || requestsQuery.isRefetching}
          onRefresh={() => void refreshAll()}
        />
      }
    >
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text maxFontSizeMultiplier={1.4} style={styles.back}>
            {FRIEND_COPY.backToProfile}
          </Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {FRIEND_COPY.title}
        </Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.segment} accessibilityRole="tablist">
        {(['friends', 'requests'] as const).map((value) => {
          const selected = tab === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(value)}
              style={[styles.segmentItem, selected ? styles.segmentOn : null]}
            >
              <Text style={[styles.segmentText, selected ? styles.segmentTextOn : null]}>
                {value === 'friends' ? FRIEND_COPY.friendsTab(friends.length) : FRIEND_COPY.requestsTab(requestCount)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <InlineError message={error ?? (loadError ? getErrorMessage(loadError, COMMON_COPY.genericError) : null)} />

      {tab === 'friends' ? (
        friends.length === 0 ? (
          <EmptyState title={FRIEND_COPY.emptyFriendsTitle} body={FRIEND_COPY.emptyFriendsBody} />
        ) : (
          <>
            <View style={styles.search}>
              <MaterialCommunityIcons name="magnify" size={20} color={appColors.mutedInk} />
              <TextInput
                accessibilityLabel={FRIEND_COPY.searchPlaceholder}
                value={query}
                onChangeText={setQuery}
                placeholder={FRIEND_COPY.searchPlaceholder}
                placeholderTextColor={appColors.softInk}
                style={styles.searchInput}
              />
            </View>
            <View style={styles.list}>
              {shownFriends.map((friend, index) => (
                <Pressable
                  key={friend.user_id}
                  accessibilityRole="button"
                  accessibilityLabel={friend.first_name}
                  onPress={() => openProfile(friend.user_id)}
                  style={[styles.friendRow, index < shownFriends.length - 1 ? styles.divider : null]}
                >
                  <Avatar initials={initialsFor(friend.first_name)} size={44} />
                  <Text style={[styles.name, styles.flex]}>{friend.first_name}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
                </Pressable>
              ))}
            </View>
          </>
        )
      ) : requestCount === 0 ? (
        <EmptyState icon="account-clock-outline" title={FRIEND_COPY.emptyRequestsTitle} body={FRIEND_COPY.emptyRequestsBody} />
      ) : (
        <>
          {incoming.length > 0 ? (
            <>
              <SectionLabel>{FRIEND_COPY.received(incoming.length)}</SectionLabel>
              <View style={styles.list}>{incoming.map(requestRow)}</View>
            </>
          ) : null}
          {outgoing.length > 0 ? (
            <>
              <SectionLabel>{FRIEND_COPY.sent(outgoing.length)}</SectionLabel>
              <View style={styles.list}>{outgoing.map(requestRow)}</View>
            </>
          ) : null}
          <Text style={styles.footer}>{FRIEND_COPY.requestsFooter}</Text>
        </>
      )}
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 48 },
  flex: { flex: 1, flexShrink: 1 },
  back: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { minWidth: 72, minHeight: 48, justifyContent: 'center' },
  title: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 17, lineHeight: 24, color: appColors.ink, textAlign: 'center' },
  segment: { flexDirection: 'row', backgroundColor: '#ece6e2', borderRadius: 999, padding: 3 },
  segmentItem: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segmentOn: { backgroundColor: appColors.white },
  segmentText: { fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.mutedInk, textAlign: 'center' },
  segmentTextOn: { color: appColors.primary },
  search: { minHeight: 48, borderRadius: radii.input, backgroundColor: appColors.white, borderWidth: 1, borderColor: appColors.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, minHeight: 48, color: appColors.ink },
  list: { backgroundColor: appColors.white, borderRadius: radii.list, overflow: 'hidden' },
  friendRow: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: appColors.line },
  name: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  sub: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  requestRow: { padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: appColors.line },
  requestWho: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  requestButtons: { flexDirection: 'row', gap: 10 },
  smallPill: { flex: 1, minHeight: 48 },
  footer: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 12.5, lineHeight: 18 },
});
