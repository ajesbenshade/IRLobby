import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionSheet } from '@components/foyer/SafetySheets';
import { PillButton } from '@components/foyer/ui';
import { ScrollView, View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import {
  PRAYER_COPY,
  PrayerClientError,
  chipLabels,
  personInitials,
  postedByLine,
  postedDayLabel,
  prayingLabel,
  visibleToLabel,
} from '@shared/prayer';
import type { MainStackParamList } from '@navigation/types';
import { fetchPrayerRequest, prayForRequest, reportPrayerRequest, stopPraying } from '@services/prayerService';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'PrayerDetail'>;

export const PrayerDetailScreen = () => {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<MainStackParamList, 'PrayerDetail'>>();
  const { prayerId } = route.params;
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const prayerQuery = useQuery({
    queryKey: ['prayer-request', String(prayerId)],
    queryFn: () => fetchPrayerRequest(prayerId),
    retry: false,
  });
  const prayer = prayerQuery.data;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['prayer-request', String(prayerId)] });
    await queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
  };

  const pray = useMutation({
    mutationFn: () => prayForRequest(prayerId),
    onSuccess: refresh,
    onError: (error) => setNotice(error instanceof PrayerClientError ? error.message : PRAYER_COPY.prayFailed),
  });
  const stop = useMutation({
    mutationFn: () => stopPraying(prayerId),
    onSuccess: refresh,
    onError: (error) => setNotice(error instanceof PrayerClientError ? error.message : PRAYER_COPY.stopFailed),
  });

  const openChat = () => {
    if (!prayer) return;
    navigation.navigate('PrayerChat', { prayerId: prayer.id, title: prayer.title });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel={PRAYER_COPY.backToPrayer} onPress={() => navigation.goBack()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={appColors.primary} />
          <Text style={styles.backText}>{PRAYER_COPY.backToPrayer}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => setMenu(true)} style={styles.more}>
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={appColors.ink} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {prayerQuery.isError ? <Text style={styles.error}>{PRAYER_COPY.loadFailed}</Text> : null}
        {prayer ? (
          <>
            <View style={styles.chips}>
              <View style={styles.prayerChip}>
                <Text style={styles.prayerChipText}>{PRAYER_COPY.prayerChip}</Text>
              </View>
              {chipLabels(prayer).map((chip) => (
                <View key={chip} style={styles.neutralChip}>
                  <Text style={styles.neutralChipText}>{chip}</Text>
                </View>
              ))}
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {prayer.title}
            </Text>
            <View style={styles.byRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{personInitials(prayer.author.name)}</Text>
              </View>
              <Text style={styles.by}>{postedByLine(prayer.author.name, postedDayLabel(prayer.createdAt))}</Text>
            </View>
            {prayer.details.trim() ? <Text style={styles.details}>{prayer.details.trim()}</Text> : null}
            <View style={styles.visible}>
              <MaterialCommunityIcons name="account-outline" size={20} color={appColors.mutedInk} />
              <Text style={styles.visibleText}>{visibleToLabel(prayer)}</Text>
            </View>
            <Text style={styles.count}>{prayingLabel(prayer.prayingCount)}</Text>
            {prayer.viewerIsPraying ? (
              <>
                <PillButton label={PRAYER_COPY.openChat} onPress={openChat} testID="prayer-open-chat" />
                <PillButton
                  label={PRAYER_COPY.stopPraying}
                  variant="text"
                  onPress={() => stop.mutate()}
                  disabled={stop.isPending}
                  testID="prayer-stop"
                />
                <Text style={styles.help}>{PRAYER_COPY.prayingHelp}</Text>
              </>
            ) : (
              <>
                <PillButton
                  label={PRAYER_COPY.imPraying}
                  onPress={() => pray.mutate()}
                  loading={pray.isPending}
                  testID="prayer-join"
                />
                <Text style={styles.help}>{PRAYER_COPY.joinHelp}</Text>
              </>
            )}
            {notice ? <Text style={styles.error}>{notice}</Text> : null}
          </>
        ) : null}
      </ScrollView>
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        rows={[
          {
            label: PRAYER_COPY.report,
            testID: 'prayer-report',
            onPress: () => {
              setMenu(false);
              void reportPrayerRequest(prayerId)
                .then((result) => {
                  setNotice(result === 'sent' ? PRAYER_COPY.reportSent : PRAYER_COPY.reportUnavailable);
                })
                .catch(() => setNotice(PRAYER_COPY.reportUnavailable));
            },
          },
        ]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 8 },
  backText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 17 },
  more: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, gap: 14, paddingBottom: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prayerChip: { backgroundColor: '#f9e8ee', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  prayerChipText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 14 },
  neutralChip: { backgroundColor: '#f3eeeb', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  neutralChipText: { color: appColors.ink, fontFamily: appTypography.bodyMedium, fontSize: 14 },
  title: { fontFamily: appTypography.heading, fontSize: 34, lineHeight: 40, color: appColors.ink, fontWeight: '700' },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3c1d0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: appColors.primary, fontSize: 11, fontFamily: appTypography.bodySemibold },
  by: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 15 },
  details: { fontFamily: appTypography.bodyRegular, fontSize: 17, lineHeight: 24, color: appColors.ink },
  visible: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: appColors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  visibleText: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 16, color: appColors.ink },
  count: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  help: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20 },
  error: { color: appColors.danger, fontFamily: appTypography.bodyRegular, fontSize: 15 },
});
