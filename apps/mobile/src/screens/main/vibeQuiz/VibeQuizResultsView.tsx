import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet } from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
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

const FOOTER_GRADIENT: readonly [string, string, string] = [
  appColors.primary,
  '#9333EA',
  appColors.accent,
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

  return (
    <View style={styles.resultsContainer}>
      <PanelCard tone="dark" style={styles.resultsCard}>
        <NativeText style={styles.badgeEmoji}>{profile.emoji}</NativeText>
        <Text variant="titleSmall" style={styles.badgeEyebrow}>
          Your vibe is
        </Text>
        <Text variant="headlineSmall" style={styles.badgeName}>
          {profile.name}
        </Text>
        <Text style={styles.badgeTagline}>{profile.tagline}</Text>
      </PanelCard>
      <PanelCard>
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
  resultsCard: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  badgeEmoji: {
    fontSize: 64,
  },
  badgeEyebrow: {
    color: '#cbd5ff',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  badgeName: {
    color: appColors.white,
    fontWeight: '800',
    textAlign: 'center',
  },
  badgeTagline: {
    color: '#dbe1ff',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
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
    backgroundColor: appColors.primarySoft,
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
