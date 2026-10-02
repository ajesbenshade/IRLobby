import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppScrollView } from '@components/AppChrome';
import { ActionSheet, BlockSheet, ConfirmSheet, ReportSheet } from '@components/foyer/SafetySheets';
import { Avatar, InlineError, PillButton, SectionLabel, Toast } from '@components/foyer/ui';
import { Image, View } from '@components/RNCompat';
import { COMMON_COPY, FRIEND_COPY, MEMBER_COPY } from '@constants/foyerCopy';
import { contactKind, initialsFor, profileView } from '@foyer/friends';
import type { MainStackParamList } from '@navigation/types';
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchMemberProfile,
  openDirectConversation,
  removeFriend,
  sendFriendRequest,
} from '@services/foyerService';
import { submitReport } from '@services/reportAdapter';
import { blockUser } from '@services/moderationService';
import { appColors, appTypography, radii } from '@theme/index';
import { getErrorMessage } from '@utils/error';

type SheetName = 'menu' | 'report' | 'block' | 'remove' | 'cancel' | null;

/** Another member's profile. Shows only what the API returns; never location or family. */
export const MemberProfileScreen = () => {
  const route = useRoute<RouteProp<MainStackParamList, 'MemberProfile'>>();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const userId = route.params.userId;
  const [sheet, setSheet] = useState<SheetName>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['foyer-member-profile', String(userId)],
    queryFn: () => fetchMemberProfile(userId),
  });
  const profile = profileQuery.data ?? null;
  const view = profileView(profileQuery.isSuccess ? profile : ({ friendship: 'none', visible: true } as never));
  const blocked = profileQuery.isSuccess && profile == null;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['foyer-member-profile'] }),
      queryClient.invalidateQueries({ queryKey: ['foyer-friends'] }),
      queryClient.invalidateQueries({ queryKey: ['foyer-friend-requests'] }),
    ]);
  };

  const run = async (action: () => Promise<void>, after?: () => void) => {
    setPending(true);
    setError(null);
    setSheetError(null);
    try {
      await action();
      await refresh();
      after?.();
    } catch (actionError) {
      const message = getErrorMessage(actionError, COMMON_COPY.genericError);
      if (sheet) {
        setSheetError(message);
      } else {
        setError(message);
      }
    } finally {
      setPending(false);
    }
  };

  const incomingRequestId = async (): Promise<number | null> => {
    const requests = await fetchFriendRequests();
    return requests.incoming.find((item) => item.user.id === Number(userId))?.id ?? null;
  };

  const name = profile?.first_name ?? '';
  const kind = profile ? contactKind(profile) : null;

  const header = (
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text maxFontSizeMultiplier={1.4} style={styles.back}>
          {COMMON_COPY.back}
        </Text>
      </Pressable>
      <View style={styles.flex} />
      {view.state !== 'blocked' && !blocked && profile && profile.friendship !== 'self' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={() => setSheet('menu')} style={styles.backButton}>
          <MaterialCommunityIcons name="dots-horizontal" size={26} color={appColors.ink} />
        </Pressable>
      ) : (
        <View style={styles.backButton} />
      )}
    </View>
  );

  if (profileQuery.isLoading) {
    return (
      <AppScrollView headerless contentContainerStyle={styles.container}>
        {header}
        <Text style={styles.sub}>Loading…</Text>
      </AppScrollView>
    );
  }

  if (blocked) {
    return (
      <AppScrollView headerless contentContainerStyle={styles.container}>
        {header}
        <View style={styles.blocked}>
          <MaterialCommunityIcons name="account-off-outline" size={40} color={appColors.mutedInk} />
          <Text accessibilityRole="header" style={styles.blockedTitle}>
            {MEMBER_COPY.blockedTitle}
          </Text>
          <Text style={styles.sub}>{MEMBER_COPY.blockedHelper}</Text>
        </View>
      </AppScrollView>
    );
  }

  if (!profile) {
    return (
      <AppScrollView headerless contentContainerStyle={styles.container}>
        {header}
        <InlineError message={profileQuery.error ? getErrorMessage(profileQuery.error, MEMBER_COPY.loadError) : MEMBER_COPY.loadError} />
        <PillButton label={COMMON_COPY.tryAgain} variant="outline" onPress={() => void profileQuery.refetch()} />
      </AppScrollView>
    );
  }

  const friendship = profile.friendship;

  return (
    <>
      <AppScrollView headerless contentContainerStyle={styles.container}>
        {header}
        <View style={styles.hero}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <Avatar initials={initialsFor(name)} size={96} />
          )}
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
        </View>

        {profile.visible && profile.bio ? (
          <>
            <SectionLabel>{MEMBER_COPY.about}</SectionLabel>
            <View style={styles.card}>
              <Text style={styles.body}>{profile.bio}</Text>
            </View>
          </>
        ) : null}

        {profile.visible && kind ? (
          <>
            <SectionLabel>{MEMBER_COPY.contact}</SectionLabel>
            <View style={styles.card}>
              {profile.phone ? (
                <View style={styles.contactRow}>
                  <Text style={styles.contactLabel}>{MEMBER_COPY.phone}</Text>
                  <Text style={styles.contactValue}>{profile.phone}</Text>
                </View>
              ) : null}
              {profile.email ? (
                <View style={styles.contactRow}>
                  <Text style={styles.contactLabel}>{MEMBER_COPY.email}</Text>
                  <Text style={styles.contactValue}>{profile.email}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {profile.visible ? (
          <Text style={styles.helper}>
            {friendship === 'friends'
              ? MEMBER_COPY.friendExplanation(name, kind)
              : MEMBER_COPY.privacyExplanation(name, kind)}
          </Text>
        ) : null}

        <InlineError message={error} />

        {view.state !== 'blocked' && view.action === 'add_friend' ? (
          <>
            <PillButton
              label={FRIEND_COPY.addFriend}
              loading={pending}
              onPress={() => void run(() => sendFriendRequest(userId).then(() => undefined))}
            />
            <Text style={styles.helper}>{FRIEND_COPY.messagingNote}</Text>
          </>
        ) : null}

        {view.state !== 'blocked' && view.action === 'request_sent' ? (
          <>
            <PillButton label={FRIEND_COPY.requestSent} disabled />
            <PillButton label={FRIEND_COPY.cancelRequest} variant="text" onPress={() => setSheet('cancel')} />
            <Text style={styles.helper}>{FRIEND_COPY.messagingNote}</Text>
          </>
        ) : null}

        {view.state !== 'blocked' && view.action === 'accept_request' ? (
          <View style={styles.pair}>
            <PillButton
              label={FRIEND_COPY.accept}
              loading={pending}
              style={styles.flex}
              onPress={() =>
                void run(async () => {
                  const id = await incomingRequestId();
                  if (id != null) {
                    await acceptFriendRequest(id);
                  }
                })
              }
            />
            <PillButton
              label={FRIEND_COPY.decline}
              variant="outline"
              disabled={pending}
              style={styles.flex}
              onPress={() =>
                void run(async () => {
                  const id = await incomingRequestId();
                  if (id != null) {
                    await declineFriendRequest(id);
                  }
                })
              }
            />
          </View>
        ) : null}

        {view.state !== 'blocked' && view.action === 'message' ? (
          <View style={styles.pair}>
            <PillButton
              label={FRIEND_COPY.message}
              loading={pending}
              style={styles.flex}
              onPress={() =>
                void run(async () => {
                  const conversation = await openDirectConversation(userId);
                  navigation.navigate('DirectChat', { conversationId: conversation.id, name });
                })
              }
            />
            <PillButton label={FRIEND_COPY.friendsCheck} variant="outline" style={styles.flex} onPress={() => setSheet('remove')} />
          </View>
        ) : null}

        {friendship !== 'self' ? (
          <PillButton label={MEMBER_COPY.reportOrBlock} variant="text" tone="ink" onPress={() => setSheet('menu')} />
        ) : null}
      </AppScrollView>

      <ActionSheet
        visible={sheet === 'menu'}
        onClose={() => setSheet(null)}
        rows={[
          { label: MEMBER_COPY.report, sub: MEMBER_COPY.reportSub, onPress: () => setSheet('report'), testID: 'menu-report' },
          { label: MEMBER_COPY.block, sub: MEMBER_COPY.blockSub, onPress: () => setSheet('block'), testID: 'menu-block' },
        ]}
      />
      <ReportSheet
        visible={sheet === 'report'}
        name={name}
        onClose={() => setSheet(null)}
        onSubmit={(payload) => submitReport({ type: 'member', userId }, payload)}
        onSent={() => {
          setSheet(null);
          setToast(MEMBER_COPY.reportSent);
        }}
      />
      <BlockSheet
        visible={sheet === 'block'}
        name={name}
        onClose={() => setSheet(null)}
        onConfirm={() => blockUser(userId)}
        onDone={() => {
          setSheet(null);
          void refresh();
          navigation.goBack();
        }}
      />
      <ConfirmSheet
        visible={sheet === 'remove'}
        title={FRIEND_COPY.removeTitle(name)}
        body={FRIEND_COPY.removeBody}
        confirmLabel={FRIEND_COPY.removeFriend}
        cancelLabel={COMMON_COPY.cancel}
        pending={pending}
        error={sheetError}
        onConfirm={() => void run(() => removeFriend(userId), () => setSheet(null))}
        onCancel={() => {
          setSheetError(null);
          setSheet(null);
        }}
      />
      <ConfirmSheet
        visible={sheet === 'cancel'}
        title={FRIEND_COPY.cancelRequestTitle}
        body={FRIEND_COPY.cancelRequestBody(name)}
        confirmLabel={FRIEND_COPY.cancelRequest}
        cancelLabel={FRIEND_COPY.keepRequest}
        pending={pending}
        error={sheetError}
        onConfirm={() => void run(() => removeFriend(userId), () => setSheet(null))}
        onCancel={() => {
          setSheetError(null);
          setSheet(null);
        }}
      />
      {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
    </>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, paddingBottom: 48 },
  flex: { flex: 1, flexShrink: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  backButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  back: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  hero: { alignItems: 'center', gap: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: appColors.ink },
  name: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 36, color: appColors.ink, textAlign: 'center' },
  card: { backgroundColor: appColors.white, borderRadius: radii.list, padding: 16, gap: 10 },
  body: { fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22, color: appColors.ink },
  sub: { fontFamily: appTypography.bodyRegular, fontSize: 14, color: appColors.mutedInk, textAlign: 'center' },
  helper: { fontFamily: appTypography.bodyRegular, fontSize: 13, lineHeight: 19, color: appColors.mutedInk },
  contactRow: { minHeight: 48, justifyContent: 'center' },
  contactLabel: { fontFamily: appTypography.bodySemibold, fontSize: 12, color: appColors.mutedInk },
  contactValue: { fontFamily: appTypography.bodyRegular, fontSize: 16, color: appColors.ink },
  pair: { flexDirection: 'row', gap: 12 },
  blocked: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  blockedTitle: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink, textAlign: 'center' },
});
