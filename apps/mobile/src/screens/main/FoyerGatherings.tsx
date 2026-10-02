import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { AppScrollView } from '@components/AppChrome';
import { FoyerHeader } from '@components/FoyerHeader';
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
  const goingQuery = useQuery({
    queryKey: ['foyer-going'],
    queryFn: () => fetchGoingActivities<Row>(),
  });

  const filterRows = (rows: Row[]) =>
    rows.filter((row) => (segment === 'upcoming' ? isUpcomingGathering(row.time) : !isUpcomingGathering(row.time)));

  const hosting = useMemo(() => filterRows((hostedQuery.data ?? []) as Row[]), [hostedQuery.data, segment]);
  const going = useMemo(() => filterRows(goingQuery.data ?? []), [goingQuery.data, segment]);

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
      <Section
        label="GOING"
        rows={going}
        summary={(row) => whosGoingSummary(row.my_rsvp?.people_count)}
        showChat={(row) => canSeeChat({ isHost: false, isGoing: isGoingRsvp(row.my_rsvp) })}
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
      return (
        <Pressable
          key={String(row.id)}
          accessibilityRole="button"
          onPress={() => onOpen(row)}
          style={styles.card}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.thumb} />
          ) : (
            <View style={styles.thumb} />
          )}
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{row.title}</Text>
            <Text style={styles.meta}>{formatWhen(row.time)}</Text>
            <Text style={styles.meta}>{summary(row)}</Text>
          </View>
          {showChat(row) ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Chat about ${row.title}`} onPress={() => onChat(row)} style={styles.chat}>
              <Text maxFontSizeMultiplier={1.4} style={styles.chatText}>Chat</Text>
            </Pressable>
          ) : null}
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  // No paddingBottom here: AppScrollView adds tab bar height + safe area + 16 inside the tabs.
  container: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  title: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 36, color: appColors.ink },
  segment: { flexDirection: 'row', backgroundColor: appColors.white, borderRadius: 12, padding: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
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
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatText: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
});
