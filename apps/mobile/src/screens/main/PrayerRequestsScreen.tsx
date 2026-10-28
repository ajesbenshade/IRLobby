import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppScrollView } from '@components/AppChrome';
import { RefreshControl, View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import { PRAYER_COPY, prayerListMeta, type PrayerScope } from '@shared/prayer';
import type { MainStackParamList, MainTabParamList } from '@navigation/types';
import { fetchPrayerRequests } from '@services/prayerService';

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Prayer'>,
  NativeStackNavigationProp<MainStackParamList>
>;

export const PrayerRequestsScreen = () => {
  const navigation = useNavigation<Navigation>();
  const [scope, setScope] = useState<PrayerScope>('active');
  const list = useQuery({
    queryKey: ['prayer-requests', scope],
    queryFn: () => fetchPrayerRequests(scope),
    retry: false,
  });
  const items = list.data?.items ?? [];
  const unavailable = list.data?.unavailable === true;
  const emptyTitle = scope === 'mine' ? PRAYER_COPY.emptyMine : PRAYER_COPY.emptyActive;
  const emptyBody = unavailable
    ? PRAYER_COPY.unavailable
    : scope === 'mine'
      ? PRAYER_COPY.emptyMineBody
      : PRAYER_COPY.emptyActiveBody;

  return (
    <AppScrollView
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {PRAYER_COPY.listTitle}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PRAYER_COPY.newRequest}
          onPress={() => navigation.navigate('PrayerCreate')}
          style={styles.plus}
          testID="prayer-create"
        >
          <MaterialCommunityIcons name="plus" size={26} color={appColors.white} />
        </Pressable>
      </View>
      <View style={styles.segment}>
        {(['active', 'mine'] as const).map((value) => {
          const selected = scope === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setScope(value)}
              style={[styles.segmentItem, selected ? styles.segmentOn : null]}
            >
              <Text style={[styles.segmentText, selected ? styles.segmentTextOn : null]}>
                {value === 'active' ? PRAYER_COPY.active : PRAYER_COPY.mine}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {list.isError ? <Text style={styles.error}>{PRAYER_COPY.loadFailed}</Text> : null}
      {!list.isLoading && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyBody}>{emptyBody}</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        {items.map((prayer) => {
          const meta = prayerListMeta(prayer);
          return (
            <Pressable
              key={String(prayer.id)}
              accessibilityRole="button"
              accessibilityLabel={`${prayer.title}. ${meta.count}${meta.rest}`}
              onPress={() => navigation.navigate('PrayerDetail', { prayerId: prayer.id })}
              style={styles.row}
            >
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{prayer.title}</Text>
                <Text style={styles.meta}>
                  <Text style={styles.metaCount}>{meta.count}</Text>
                  <Text style={styles.metaRest}>{meta.rest}</Text>
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
            </Pressable>
          );
        })}
      </View>
    </AppScrollView>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontFamily: appTypography.heading, fontSize: 34, lineHeight: 40, color: appColors.ink, fontWeight: '700' },
  plus: { width: 48, height: 48, borderRadius: 24, backgroundColor: appColors.primary, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', backgroundColor: '#efe8e4', borderRadius: 14, padding: 4, marginTop: 16 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: appColors.white },
  segmentText: { fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.mutedInk },
  segmentTextOn: { color: appColors.primary },
  list: { gap: 12, marginTop: 16 },
  row: {
    backgroundColor: appColors.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  rowCopy: { flex: 1, gap: 6 },
  rowTitle: { fontFamily: appTypography.heading, fontSize: 20, lineHeight: 26, color: appColors.ink, fontWeight: '700' },
  meta: { fontSize: 14, lineHeight: 20 },
  metaCount: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  metaRest: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular },
  empty: { marginTop: 48, gap: 8, paddingHorizontal: 12 },
  emptyTitle: { fontFamily: appTypography.heading, fontSize: 22, color: appColors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: appTypography.bodyRegular, fontSize: 16, lineHeight: 22, color: appColors.mutedInk, textAlign: 'center' },
  error: { marginTop: 16, color: appColors.danger, fontFamily: appTypography.bodyRegular, fontSize: 15 },
});
