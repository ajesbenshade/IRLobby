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
        onChat={() => navigation.navigate('Chat')}
        onOpen={(row) => navigation.getParent()?.navigate('GatheringDetail', { activityId: row.id })}
      />
      <Section
        label="GOING"
        rows={going}
        summary={(row) => whosGoingSummary(row.my_rsvp?.people_count)}
        onChat={() => navigation.navigate('Chat')}
        onOpen={(row) => navigation.getParent()?.navigate('GatheringDetail', { activityId: row.id })}
      />
    </AppScrollView>
  );
};

const Section = ({
  label,
  rows,
  summary,
  onChat,
  onOpen,
}: {
  label: string;
  rows: Row[];
  summary: (row: Row) => string;
  onChat: () => void;
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
          <Pressable accessibilityRole="button" accessibilityLabel={`Chat about ${row.title}`} onPress={onChat} style={styles.chat}>
            <Text style={styles.chatText}>Chat</Text>
          </Pressable>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 120 },
  title: { fontFamily: appTypography.heading, fontSize: 28, color: appColors.ink },
  segment: { flexDirection: 'row', backgroundColor: appColors.white, borderRadius: 12, padding: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
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
  cardCopy: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: appTypography.heading, fontSize: 16, color: appColors.ink },
  meta: { fontFamily: appTypography.bodyRegular, fontSize: 13, color: appColors.mutedInk },
  chat: {
    backgroundColor: appColors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatText: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
});
