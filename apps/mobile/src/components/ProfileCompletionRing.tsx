import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import { useAuth } from '@hooks/useAuth';
import { appColors, radii, spacing } from '@theme/index';

type CompletionItem = {
  key: string;
  label: string;
  done: boolean;
};

type ProfileCompletionRingProps = {
  onPress?: () => void;
};

const RING_SIZE = 64;
const STROKE = 6;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Compact "Complete your profile" card with a circular progress ring.
 * Surfaces the lazy-onboarding items (bio, extra photos, vibes, etc.) that
 * were moved out of the 3-step onboarding flow.
 *
 * Tap to navigate to Profile — the actual edit fields live in the Profile
 * screen below this ring, so a no-op onPress is fine when this is already
 * rendered there.
 */
export const ProfileCompletionRing = ({ onPress }: ProfileCompletionRingProps) => {
  const { user } = useAuth();

  const items = useMemo<CompletionItem[]>(() => {
    const interestsCount = user?.interests?.length ?? 0;
    const albumCount = user?.photoAlbum?.length ?? 0;
    return [
      { key: 'avatar', label: 'Profile photo', done: Boolean(user?.avatarUrl?.trim()) },
      { key: 'bio', label: 'Short bio', done: Boolean(user?.bio?.trim()) },
      { key: 'city', label: 'Your city', done: Boolean(user?.city?.trim()) },
      { key: 'vibes', label: 'Pick a few vibes', done: interestsCount >= 3 },
      { key: 'album', label: 'Add 3+ photos', done: albumCount >= 3 },
    ];
  }, [user]);

  const completed = items.filter((item) => item.done).length;
  const total = items.length;
  const percent = total === 0 ? 0 : completed / total;
  const strokeDashoffset = CIRCUMFERENCE * (1 - percent);

  if (completed === total) {
    return null;
  }

  const nextItem = items.find((item) => !item.done);

  const Wrapper: typeof Pressable | typeof View = onPress ? Pressable : View;

  return (
    <Wrapper
      style={styles.card}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Profile ${Math.round(percent * 100)}% complete`}
    >
      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={appColors.line}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={appColors.primary}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.percentText}>{Math.round(percent * 100)}%</Text>
        </View>
      </View>
      <View style={styles.copy}>
        <Text variant="titleMedium" style={styles.title}>
          Complete your profile
        </Text>
        <Text style={styles.subtitle}>
          {nextItem ? `Next: ${nextItem.label}` : 'Almost there.'}
        </Text>
        <Text style={styles.meta}>
          {completed} of {total} done
        </Text>
      </View>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: appColors.primarySoft,
    borderWidth: 1,
    borderColor: appColors.line,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    color: appColors.primaryDeep,
    fontWeight: '800',
    fontSize: 14,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: appColors.ink,
    fontWeight: '800',
  },
  subtitle: {
    color: appColors.mutedInk,
    fontSize: 13,
  },
  meta: {
    color: appColors.softInk,
    fontSize: 12,
    marginTop: 2,
  },
});
