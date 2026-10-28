import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ComponentType } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { PrayerCard } from '@components/prayer/PrayerCard';
import { View } from '@components/RNCompat';
import { useSwipeCard } from '@hooks/useSwipeCard';
import { appColors, appTypography } from '@theme/index';
import { PRAYER_COPY, PrayerClientError, type PrayerRequest } from '@shared/prayer';
import { fetchPrayerRequests, passPrayerRequest, prayForRequest } from '@services/prayerService';

const AnimatedView = Animated.View as unknown as ComponentType<any>;

type Props = {
  /** Prayer-only Discover has no gathering underneath, so an empty deck needs a sentence. */
  showEmpty: boolean;
  onOpen: (prayer: PrayerRequest) => void;
  onJoined: (prayer: PrayerRequest) => void;
};

export const DiscoverPrayerDeck = ({ showEmpty, onOpen, onJoined }: Props) => {
  const queryClient = useQueryClient();
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const prayers = useQuery({
    queryKey: ['prayer-requests', 'discover'],
    queryFn: () => fetchPrayerRequests('discover'),
    retry: false,
  });
  const items = (prayers.data?.items ?? []).filter((item) => !skipped.has(String(item.id)) && !item.viewerIsPraying);
  const current = items[0] ?? null;

  const pray = useMutation({
    mutationFn: (prayer: PrayerRequest) => prayForRequest(prayer.id),
    onSuccess: async (_result, prayer) => {
      setSkipped((previous) => new Set(previous).add(String(prayer.id)));
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      onJoined(prayer);
    },
  });

  const swipe = useSwipeCard({
    enabled: Boolean(current) && !pray.isPending,
    resetKey: current ? String(current.id) : 'none',
    onCommit: async (direction) => {
      if (!current) return false;
      if (direction === 'left') {
        setSkipped((previous) => new Set(previous).add(String(current.id)));
        void passPrayerRequest(current.id).catch(() => undefined);
        setReleasing(false);
        return true;
      }
      try {
        await pray.mutateAsync(current);
        setReleasing(false);
        return true;
      } catch (prayError) {
        setError(prayError instanceof PrayerClientError ? prayError.message : PRAYER_COPY.prayFailed);
        setReleasing(false);
        return false;
      }
    },
  });

  useEffect(() => {
    const id = swipe.pan.x.addListener(({ value }) => {
      setReleasing((previous) => {
        const next = value > 56;
        return previous === next ? previous : next;
      });
    });
    return () => swipe.pan.x.removeListener(id);
  }, [swipe.pan]);

  if (!current) {
    if (!showEmpty || prayers.isLoading) return null;
    return <Text style={styles.empty}>{PRAYER_COPY.emptyDiscover}</Text>;
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <View style={styles.reveal} pointerEvents="none">
          <MaterialCommunityIcons name="check-circle" size={28} color={appColors.primary} />
          <Text style={styles.revealText}>{PRAYER_COPY.imPraying}</Text>
        </View>
        <AnimatedView style={swipe.cardStyle} {...swipe.panHandlers}>
          <Pressable accessibilityRole="button" accessibilityLabel={current.title} onPress={() => onOpen(current)}>
            <PrayerCard prayer={current} />
          </Pressable>
        </AnimatedView>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PRAYER_COPY.pass}
          onPress={() => void swipe.commit('left')}
          style={styles.pass}
          testID="prayer-pass"
        >
          <Text style={styles.passText}>{PRAYER_COPY.pass}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PRAYER_COPY.imPraying}
          onPress={() => void swipe.commit('right')}
          style={styles.pray}
          testID="prayer-im-praying"
        >
          <Text style={styles.prayText}>{PRAYER_COPY.imPraying}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>{releasing ? PRAYER_COPY.releaseHint : PRAYER_COPY.swipeHint}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 14, marginTop: 8 },
  stage: { minHeight: 180, justifyContent: 'center' },
  reveal: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  revealText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 13, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  pass: {
    width: 110,
    minHeight: 54,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: '#c8beba',
    backgroundColor: appColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passText: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  pray: {
    flex: 1,
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prayText: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.white },
  hint: { textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14 },
  error: { textAlign: 'center', color: appColors.danger, fontFamily: appTypography.bodyMedium, fontSize: 14 },
  empty: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 16, textAlign: 'center', marginTop: 24 },
});
