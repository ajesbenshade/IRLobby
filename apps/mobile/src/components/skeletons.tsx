import { StyleSheet } from 'react-native';

import { Skeleton } from '@components/Skeleton';
import { PanelCard } from '@components/AppChrome';
import { View } from '@components/RNCompat';
import { appColors, radii, spacing } from '@theme/index';

/**
 * Loading placeholder for an activity discovery card. Mirrors the hero-image
 * + title + meta + tag-row layout used in `DiscoverScreen`.
 */
export const ActivityCardSkeleton = () => (
  <PanelCard style={styles.cardReset}>
    <View style={styles.cardContent} accessibilityLabel="Loading activity" accessible>
      <Skeleton width={120} height={20} />
      <Skeleton height={220} radius={radii.lg} />
      <Skeleton width="70%" height={18} />
      <Skeleton width="50%" height={14} />
      <View style={styles.tagRow}>
        <Skeleton width={70} height={26} radius={radii.pill} />
        <Skeleton width={70} height={26} radius={radii.pill} />
      </View>
    </View>
  </PanelCard>
);

/**
 * Loading placeholder for a single Matches list row. Mirrors the layout in
 * `MatchesScreen` (PanelCard → eyebrow + title + people row + meta row).
 */
export const MatchCardSkeleton = () => (
  <PanelCard style={styles.cardReset} tone="default">
    <View style={styles.cardContent} accessibilityLabel="Loading match" accessible>
      <Skeleton width={70} height={18} radius={radii.pill} />
      <Skeleton width="70%" height={20} />
      <View style={styles.peopleRow}>
        <Skeleton width={34} height={34} radius={17} />
        <Skeleton width={90} height={14} />
        <Skeleton width={20} height={14} />
        <Skeleton width={34} height={34} radius={17} />
        <Skeleton width={90} height={14} />
      </View>
      <View style={styles.metaRow}>
        <Skeleton width={70} height={12} />
        <Skeleton width={120} height={12} />
      </View>
    </View>
  </PanelCard>
);

/**
 * Loading row for the Notifications screen feed.
 */
export const NotificationRowSkeleton = () => (
  <View style={styles.feedRow} accessibilityLabel="Loading notification" accessible>
    <Skeleton width={36} height={36} radius={18} />
    <View style={styles.feedContent}>
      <Skeleton width="60%" height={16} />
      <Skeleton width="90%" height={14} />
      <Skeleton width={80} height={12} />
    </View>
  </View>
);

/**
 * Inline shimmer used on the Vibe Quiz results screen while we count matches.
 */
export const VibeMatchCountSkeleton = () => (
  <View style={styles.matchCount} accessibilityLabel="Counting your matches" accessible>
    <Skeleton width="80%" height={20} />
    <View style={styles.matchCountChips}>
      <Skeleton width={70} height={26} radius={radii.pill} />
      <Skeleton width={88} height={26} radius={radii.pill} />
      <Skeleton width={60} height={26} radius={radii.pill} />
    </View>
  </View>
);

/**
 * Full-screen loading placeholder for the standalone Vibe Quiz results screen.
 * Renders a badge pill, profile-name block, match-count line, and a horizontal
 * row of three card placeholders.
 */
export const VibeQuizSkeleton = () => (
  <View style={styles.vibeQuizRoot} accessibilityLabel="Loading your vibe" accessible>
    <PanelCard tone="dark" style={styles.cardReset}>
      <View style={styles.vibeBadge}>
        <Skeleton width={120} height={28} radius={radii.pill} />
        <Skeleton width={220} height={28} />
        <Skeleton width={180} height={14} />
      </View>
    </PanelCard>
    <PanelCard style={styles.cardReset}>
      <View style={styles.matchCount}>
        <Skeleton width="70%" height={20} />
        <View style={styles.matchCountChips}>
          <Skeleton width={70} height={26} radius={radii.pill} />
          <Skeleton width={88} height={26} radius={radii.pill} />
          <Skeleton width={60} height={26} radius={radii.pill} />
        </View>
      </View>
    </PanelCard>
    <View style={styles.vibeCardRow}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.vibeCard}>
          <Skeleton height={130} radius={radii.lg} />
          <Skeleton width="70%" height={18} />
          <Skeleton width="50%" height={14} />
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  cardReset: {
    marginBottom: 0,
  },
  cardContent: {
    gap: spacing.sm,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: appColors.line,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  feedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  feedContent: {
    flex: 1,
    gap: spacing.xs,
  },
  matchCount: {
    gap: spacing.sm,
  },
  matchCountChips: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  tagRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  vibeQuizRoot: {
    gap: spacing.lg,
  },
  vibeBadge: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  vibeCardRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  vibeCard: {
    flex: 1,
    gap: spacing.sm,
    backgroundColor: appColors.cardStrong,
    padding: spacing.sm,
    borderRadius: radii.lg,
  },
});
