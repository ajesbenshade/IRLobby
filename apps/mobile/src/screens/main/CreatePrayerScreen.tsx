import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrayerVisibilityFields } from '@components/prayer/PrayerVisibilityFields';
import { ScrollView, View } from '@components/RNCompat';
import { appColors, appTypography, radii } from '@theme/index';
import { PRAYER_COPY, PrayerClientError, buildPrayerCreate, initialCircleIds, type PrayerCreatePayload } from '@shared/prayer';
import type { MainStackParamList } from '@navigation/types';
import { createPrayerRequest, fetchPrayerCircles } from '@services/prayerService';

type Navigation = NativeStackNavigationProp<MainStackParamList, 'PrayerCreate'>;

export const CreatePrayerScreen = () => {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [circleIds, setCircleIds] = useState<Array<number | string>>([]);
  const [untouched, setUntouched] = useState(true);
  const [wholeChurch, setWholeChurch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const circles = useQuery({
    queryKey: ['prayer-circles'],
    queryFn: () => fetchPrayerCircles(),
    retry: false,
  });
  const circleRows = circles.data?.circles ?? [];

  useEffect(() => {
    const rows = circles.data?.circles ?? [];
    setCircleIds((current) => initialCircleIds(rows, untouched, current));
  }, [circles.data, untouched]);

  const circlesStatus = circles.isLoading
    ? 'loading'
    : circles.isError
      ? 'error'
      : circles.data?.unavailable
        ? 'unavailable'
        : circleRows.length === 0
          ? 'empty'
          : 'ready';

  const draft = buildPrayerCreate({ title, details, circleIds, wholeChurch });

  const post = useMutation({
    mutationFn: (payload: PrayerCreatePayload) => createPrayerRequest(payload),
    onSuccess: async (prayer) => {
      await queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      navigation.replace('PrayerDetail', { prayerId: prayer.id });
    },
    onError: (postError) => {
      setError(postError instanceof PrayerClientError ? postError.message : PRAYER_COPY.postFailed);
    },
  });

  const submit = () => {
    if (!draft.ok) {
      setError(draft.message);
      return;
    }
    setError(null);
    post.mutate(draft.payload);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.navSide}>
          <Text style={styles.navAction}>{PRAYER_COPY.cancel}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.navTitle}>
          {PRAYER_COPY.createTitle}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: post.isPending }}
          onPress={submit}
          style={styles.navSide}
          testID="prayer-post"
        >
          <Text style={[styles.navAction, !draft.ok ? styles.navActionMuted : null]}>{PRAYER_COPY.post}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{PRAYER_COPY.titleLabel}</Text>
        <TextInput
          accessibilityLabel={PRAYER_COPY.titleLabel}
          value={title}
          onChangeText={setTitle}
          placeholder={PRAYER_COPY.titlePlaceholder}
          placeholderTextColor={appColors.softInk}
          style={styles.input}
        />
        <Text style={styles.hint}>{PRAYER_COPY.required}</Text>
        <Text style={styles.label}>{PRAYER_COPY.detailsLabel}</Text>
        <TextInput
          accessibilityLabel={PRAYER_COPY.detailsLabel}
          value={details}
          onChangeText={setDetails}
          placeholder={PRAYER_COPY.detailsPlaceholder}
          placeholderTextColor={appColors.softInk}
          multiline
          style={[styles.input, styles.details]}
        />
        <Text style={styles.hint}>{PRAYER_COPY.detailsHelper}</Text>
        <PrayerVisibilityFields
          circles={circleRows}
          selectedIds={circleIds}
          onChangeSelected={(ids) => {
            setUntouched(false);
            setCircleIds(ids);
          }}
          wholeChurch={wholeChurch}
          onChangeWholeChurch={setWholeChurch}
          circlesStatus={circlesStatus}
          onBrowseCircles={() => navigation.navigate('Circles')}
        />
        <Text style={styles.footnote}>{PRAYER_COPY.noDatePlace}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: appColors.background },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 48 },
  navSide: { minWidth: 72, minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  navTitle: { flex: 1, textAlign: 'center', fontFamily: appTypography.bodySemibold, fontSize: 17, color: appColors.ink },
  navAction: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 17 },
  navActionMuted: { color: '#c9a3b2' },
  body: { padding: 20, gap: 8, paddingBottom: 40 },
  label: { marginTop: 12, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  input: {
    minHeight: 52,
    borderRadius: radii.input ?? 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: appTypography.bodyRegular,
    fontSize: 16,
    color: appColors.ink,
  },
  details: { minHeight: 110, textAlignVertical: 'top' },
  hint: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14 },
  footnote: { marginTop: 16, color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22 },
  error: { color: appColors.danger, fontFamily: appTypography.bodyMedium, fontSize: 15 },
});
