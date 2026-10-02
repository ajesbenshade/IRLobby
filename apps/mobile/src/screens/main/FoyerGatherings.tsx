import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { AppScrollView } from '@components/AppChrome';
import { FoyerHeader } from '@components/FoyerHeader';
import { GRAYSCALE_IMAGE_STYLE } from '@components/foyer/ui';
import { RefreshControl, View } from '@components/RNCompat';
import {
  coverPhotoUrl,
  goingCountLabel,
  hostDisplayName,
  isUpcomingGathering,
  whosGoingSummary,
  type GatheringLike,
} from '@foyer/logic';
import type { MainStackParamList, MainTabParamList } from '@navigation/types';
import { fetchHostedActivities } from '@services/activityService';
import { fetchGoingActivities } from '@services/foyerService';
import { APPROVAL_COPY, CANCEL_COPY, FULL_COPY } from '@constants/foyerCopy';
import { useDetectedCapabilities, isRequireApprovalEnabled } from '@foyer/capabilities';
import { sortCancelledLast } from '@foyer/cancel';
import { rowShowsChat, rowTag, splitGoingRows, type RowTag } from '@foyer/gatheringsList';
import { openGatheringChat, type StackNavigate } from '@foyer/gatheringChat';
import { canSeeChat, isGoingRsvp } from '@foyer/rsvp';
import { appColors, appTypography, radii } from '@theme/index';

import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Activity } from '../../types/activity';

type Row = Activity & GatheringLike;

const formatWhen = (value?: string) => {
  if (!value) {
    return 'Date pending';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const FoyerGatherings = () => {
  const navigation = useNavigation<
    CompositeNavigationProp<
      BottomTabNavigationProp<MainTabParamList, 'Activity'>,
      NativeStackNavigationProp<MainStackParamList>
    >
  >();
  // The Gatherings tab lives inside the main stack; chat and detail are stack screens.
  const stackNavigation = () => (navigation.getParent() ?? navigation) as unknown as StackNavigate;
  const [segment, setSegment] = useState<'upcoming' | 'past'>('upcoming');
  const hostedQuery = useQuery({
    queryKey: ['foyer-hosted'],
    queryFn: fetchHostedActivities,
  });
  // The going list also carries pending/declined requests once the backend supports Require approval.
  useDetectedCapabilities();
  const approvalOn = isRequireApprovalEnabled();
  const goingQuery = useQuery({
    queryKey: ['foyer-going', approvalOn],
    queryFn: () => fetchGoingActivities<Row>(),
  });

  const filterRows = (rows: Row[]) =>
    rows.filter((row) => (segment === 'upcoming' ? isUpcomingGathering(row.time) : !isUpcomingGathering(row.time)));

  const hosting = useMemo(() => sortCancelledLast(filterRows((hostedQuery.data ?? []) as Row[])), [hostedQuery.data, segment]);
  const { requests, going } = useMemo(() => splitGoingRows(filterRows(goingQuery.data ?? [])), [goingQuery.data, segment]);

  return (
    <AppScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={hostedQuery.isRefetching || goingQuery.isRefetching}
          onRefresh={() => {
            void hostedQuery.refetch();
            void goingQuery.refetch();
          }}
        />
      }
    >
      <FoyerHeader />
      <Text style={styles.title}>Your gatherings</Text>
      <View style={styles.segment}>
        {(['upcoming', 'past'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: segment === value }}
            onPress={() => setSegment(value)}
            style={[styles.segmentItem, segment === value ? styles.segmentOn : null]}
          >
            <Text style={[styles.segmentText, segment === value ? styles.segmentTextOn : null]}>
              {value === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Section
        label="HOSTING"
        rows={hosting}
        summary={(row) => goingCountLabel(row.going_count ?? row.participant_count ?? 0)}
        showChat={() => true}
        onChat={(row) => openGatheringChat(stackNavigation(), { activityId: row.id, title: row.title })}
        onOpen={(row) => stackNavigation().navigate('GatheringDetail', { activityId: row.id })}
      />
      {approvalOn && requests.length > 0 ? (
        <Section
          label={APPROVAL_COPY.groupRequests}
          rows={requests}
          summary={() => ''}
          showChat={() => false}
          onChat={() => undefined}
          onOpen={(row) => stackNavigation().navigate('GatheringDetail', { activityId: row.id })}
        />
      ) : null}
      <Section
        label="GOING"
        rows={going}
        summary={(row) => whosGoingSummary(row.my_rsvp?.people_count)}
        showChat={(row) => canSeeChat({ isHost: false, isGoing: isGoingRsvp(row.my_rsvp) }) && rowShowsChat(row)}
        onChat={(row) => openGatheringChat(stackNavigation(), { activityId: row.id, title: row.title })}
        onOpen={(row) => stackNavigation().navigate('GatheringDetail', { activityId: row.id })}
      />
    </AppScrollView>
  );
};

const Section = ({
  label,
  rows,
  summary,
  showChat,
  onChat,
  onOpen,
}: {
  label: string;
  rows: Row[];
  summary: (row: Row) => string;
  /** Chat is only for the host and people who are going. */
  showChat: (row: Row) => boolean;
  /** Opens that gathering's chat (with the gathering underneath, so Back returns to it). */
  onChat: (row: Row) => void;
  onOpen: (row: Row) => void;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionLabel}>{label}</Text>
    {rows.length === 0 ? <Text style={styles.empty}>Nothing here yet.</Text> : null}
    {rows.map((row) => {
      const photo = coverPhotoUrl(row);
      const tag = rowTag(row);
      const cancelled = tag === 'cancelled';
      // On a cancelled row the tag replaces the going count / "You" line.
      const summaryText = cancelled ? '' : summary(row);
      return (
        <Pressable
          key={String(row.id)}
          accessibilityRole="button"
          onPress={() => onOpen(row)}
          style={styles.card}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={[styles.thumb, cancelled ? GRAYSCALE_IMAGE_STYLE : null]} />
          ) : (
            <View style={[styles.thumb, cancelled ? GRAYSCALE_IMAGE_STYLE : null]} />
          )}
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, cancelled ? styles.mutedText : null]}>{row.title}</Text>
            <Text style={[styles.meta, cancelled ? styles.struck : null]}>{formatWhen(row.time)}</Text>
            {summaryText ? <Text style={styles.meta}>{summaryText}</Text> : null}
            <View style={styles.tagRow}>
              {tag ? <TagPill tag={tag} /> : null}
              {row.is_full === true && tag !== 'cancelled' ? (
                <View style={[styles.tag, tagStyles.cancelled]} accessibilityLabel={FULL_COPY.tag} testID="full-tag">
                  <Text maxFontSizeMultiplier={1.4} style={[styles.tagText, tagTextStyles.cancelled]}>{FULL_COPY.tag}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {showChat(row) ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Chat about ${row.title}`} onPress={() => onChat(row)} style={[styles.chat, cancelled ? styles.chatMuted : null]}>
              <Text maxFontSizeMultiplier={1.4} style={styles.chatText}>Chat</Text>
            </Pressable>
          ) : null}
        </Pressable>
      );
    })}
  </View>
);

const TAG_LABEL: Record<RowTag, string> = {
  cancelled: CANCEL_COPY.tag,
  pending: APPROVAL_COPY.tagPending,
  declined: APPROVAL_COPY.tagDeclined,
  closed: APPROVAL_COPY.tagClosed,
  approved: APPROVAL_COPY.tagApproved,
};

/** Pending = burgundy outline + clock; Approved = tint + check; Declined/Cancelled = grey fill; Closed = muted outline. */
const TagPill = ({ tag }: { tag: RowTag }) => (
  <View style={[styles.tag, tagStyles[tag]]} accessibilityLabel={TAG_LABEL[tag]}>
    {tag === 'pending' ? <MaterialCommunityIcons name="clock-outline" size={13} color={appColors.primary} /> : null}
    {tag === 'approved' ? <MaterialCommunityIcons name="check" size={13} color={appColors.primary} /> : null}
    <Text maxFontSizeMultiplier={1.4} style={[styles.tagText, tagTextStyles[tag]]}>
      {TAG_LABEL[tag]}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 },
  tagText: { fontFamily: appTypography.bodySemibold, fontSize: 12, lineHeight: 16 },
  struck: { textDecorationLine: 'line-through', color: '#7a7572' },
  mutedText: { color: '#7a7572' },
  chatMuted: { backgroundColor: appColors.white, borderWidth: 1.5, borderColor: appColors.primary },
  // No paddingBottom here: AppScrollView adds tab bar height + safe area + 16 inside the tabs.
  container: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  title: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 36, color: appColors.ink },
  segment: { flexDirection: 'row', backgroundColor: appColors.white, borderRadius: 12, padding: 4 },
  segmentItem: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  segmentOn: { backgroundColor: appColors.white, borderWidth: 1, borderColor: appColors.line },
  segmentText: { fontFamily: appTypography.bodyMedium, color: appColors.mutedInk },
  segmentTextOn: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  section: { gap: 10 },
  sectionLabel: { fontFamily: appTypography.bodySemibold, fontSize: 12, letterSpacing: 0.6, color: appColors.mutedInk },
  empty: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: appColors.white,
    borderRadius: radii.card,
    padding: 12,
  },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: appColors.primarySoft },
  cardCopy: { flex: 1, flexShrink: 1, gap: 2 },
  cardTitle: { fontFamily: appTypography.heading, fontSize: 16, lineHeight: 22, color: appColors.ink },
  meta: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  chat: {
    backgroundColor: appColors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignSelf: 'center',
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatText: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
});

const tagStyles = StyleSheet.create({
  cancelled: { backgroundColor: '#e1dbd7' },
  pending: { borderWidth: 1.5, borderColor: appColors.primary, backgroundColor: appColors.white },
  declined: { backgroundColor: '#a49b96' },
  closed: { borderWidth: 1.5, borderColor: '#cec8c4', backgroundColor: '#f3f0ee' },
  approved: { backgroundColor: appColors.primarySoft },
});

const tagTextStyles = StyleSheet.create({
  cancelled: { color: '#5b5551' },
  pending: { color: appColors.primary },
  declined: { color: '#ffffff' },
  closed: { color: '#7a7572' },
  approved: { color: appColors.primary },
});
