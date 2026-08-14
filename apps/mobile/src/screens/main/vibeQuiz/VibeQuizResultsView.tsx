import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ImageBackground, Pressable, StyleSheet } from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  VIBE_PROFILE_LABELS,
  type VibeProfile,
  type VibeTag,
} from '@shared/schema';

import { PanelCard } from '@components/AppChrome';
import { Text as NativeText, View } from '@components/RNCompat';
import { VibeMatchCountSkeleton } from '@components/skeletons';
import { useOnline } from '@hooks/useOnline';
import { fetchActivities } from '@services/activityService';
import { appColors, radii, spacing } from '@theme/index';
import { VIBE_QUIZ_IMAGES } from './vibeQuizImages';

const FOOTER_GRADIENT: readonly [string, string, string] = [
  appColors.primary,
  appColors.primaryDeep,
  appColors.secondary,
];

export interface VibeQuizResultsViewProps {
  vibeProfile: VibeProfile;
  vibeTags: VibeTag[];
  discoverTags: string[];
  ctaLabel: string;
  onCta: () => void;
  isCtaPending?: boolean;
  errorMessage?: string | null;
  /** Optional staleTime override; defaults to 60s for the in-quiz preview. */
  staleTimeMs?: number;
  /** Optional caching tier — 24h `gcTime` for the standalone screen. */
  gcTimeMs?: number;
}

export const VibeQuizResultsView = ({
  vibeProfile,
  vibeTags,
  discoverTags,
  ctaLabel,
  onCta,
  isCtaPending = false,
  errorMessage = null,
  staleTimeMs = 60_000,
  gcTimeMs,
}: VibeQuizResultsViewProps) => {
  const profile = VIBE_PROFILE_LABELS[vibeProfile];
  const isOnline = useOnline();

  const matchCountQuery = useQuery({
    queryKey: ['vibe-quiz-match-count', discoverTags] as const,
    queryFn: () => fetchActivities({ tags: discoverTags }),
    enabled: discoverTags.length > 0,
    staleTime: staleTimeMs,
    ...(gcTimeMs !== undefined ? { gcTime: gcTimeMs } : {}),
  });

  const matchCount = matchCountQuery.data?.length ?? 0;
  const hasCached = (matchCountQuery.data?.length ?? 0) > 0;
  const showOfflineCachedCopy = !isOnline && hasCached;
  const showSkeleton = matchCountQuery.isLoading && !hasCached;

  const vibeImage =
    vibeProfile in VIBE_QUIZ_IMAGES
      ? VIBE_QUIZ_IMAGES[vibeProfile as keyof typeof VIBE_QUIZ_IMAGES]
      : null;

  const imageOpacity = useSharedValue(0);
  const imageTranslate = useSharedValue(18);

  // Subtle entrance animation for the hero image
  useEffect(() => {
    imageOpacity.value = withDelay(60, withTiming(1, { duration: 380 }));
    imageTranslate.value = withDelay(60, withTiming(0, { duration: 420 }));
  }, []);

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ translateY: imageTranslate.value }],
  }));

  return (
    <View style={styles.resultsContainer}>
      {/* Immersive ImageBackground hero with the result card content overlaid */}
      {vibeImage && (
        <Animated.View style={[styles.vibeHero, heroAnimatedStyle]}>
          <ImageBackground
            source={vibeImage}
            style={styles.vibeHeroImage}
            imageStyle={{ borderRadius: radii.xl }}
            resizeMode="cover"
          >
            {/* Stronger gradient overlay for readability + premium depth */}
            <LinearGradient
              colors={['rgba(10,8,20,0.15)', 'rgba(10,8,20,0.72)', 'rgba(10,8,20,0.92)']}
              locations={[0, 0.55, 1]}
              style={styles.vibeHeroGradient}
            >
              <View style={styles.vibeHeroContent}>
                <NativeText style={styles.badgeEmojiSmall}>{profile.emoji}</NativeText>
                <Text variant="titleSmall" style={styles.badgeEyebrowLight}>
                  Your vibe is
                </Text>
                <Text variant="headlineMedium" style={styles.badgeNameLight}>
                  {profile.name}
                </Text>
                <Text style={styles.badgeTaglineLight}>{profile.tagline}</Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </Animated.View>
      )}

      {/* Match count and tags as a clean card below the immersive hero */}
      <PanelCard tone="dark" style={styles.resultsCard}>
        {showSkeleton ? (
          <VibeMatchCountSkeleton />
        ) : (
          <>
            <Text variant="titleMedium" style={styles.matchCountTitle}>
              {showOfflineCachedCopy
                ? 'Showing your last saved matches — reconnect to refresh'
                : `We found ${matchCount} ${matchCount === 1 ? 'activity' : 'activities'} that match your energy!`}
            </Text>
            <View style={styles.tagRow}>
              {vibeTags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <NativeText style={styles.tagChipText}>{tag.replace(/_/g, ' ')}</NativeText>
                </View>
              ))}
            </View>
          </>
        )}
      </PanelCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        onPress={onCta}
        disabled={isCtaPending}
        style={({ pressed }) => [
          styles.primaryButtonWrap,
          pressed ? styles.primaryButtonPressed : null,
        ]}
      >
        <LinearGradient
          colors={FOOTER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryButton}
        >
          <NativeText style={styles.primaryButtonText}>
            {isCtaPending ? 'Saving your vibe…' : ctaLabel}
          </NativeText>
        </LinearGradient>
      </Pressable>
      {errorMessage ? (
        <HelperText type="error" visible style={styles.error}>
          {errorMessage}
        </HelperText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  resultsContainer: {
    gap: spacing.lg,
    alignItems: 'stretch',
  },
  vibeHero: {
    width: '100%',
    height: 300,
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  vibeHeroImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  vibeHeroGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.xl,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  vibeHeroContent: {
    gap: 4,
  },
  resultsCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  badgeEmojiSmall: {
    fontSize: 36,
    marginBottom: 2,
  },
  // Old large emoji style kept for reference but no longer used in main results
  badgeEmoji: {
    fontSize: 28,
    opacity: 0.9,
  },
  badgeEyebrow: {
    color: 'rgba(244, 243, 250, 0.72)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  badgeEyebrowLight: {
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    fontSize: 12,
  },
  badgeName: {
    color: appColors.white,
    fontWeight: '800',
    textAlign: 'center',
  },
  badgeNameLight: {
    color: appColors.white,
    fontWeight: '800',
    fontSize: 26,
    lineHeight: 30,
  },
  badgeTagline: {
    color: 'rgba(244, 243, 250, 0.78)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  badgeTaglineLight: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 18,
    marginTop: 2,
  },
  matchCountTitle: {
    color: appColors.ink,
    fontWeight: '800',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tagChip: {
    borderRadius: radii.pill,
    backgroundColor: 'rgba(91, 75, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagChipText: {
    color: appColors.primaryDeep,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  primaryButtonWrap: {
    width: '100%',
    borderRadius: radii.pill,
    shadowColor: appColors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  primaryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  error: {
    color: appColors.danger,
    textAlign: 'center',
  },
});
