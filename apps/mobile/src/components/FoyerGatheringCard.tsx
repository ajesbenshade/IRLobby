import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

import { View } from '@components/RNCompat';
import { TIGHT_CHROME_MAX_FONT_SCALE } from '@navigation/tabBarLayout';
import { appColors, appTypography, radii } from '@theme/index';

type FoyerGatheringCardProps = {
  title: string;
  audienceLabel: string;
  goingLabel: string;
  timeLabel: string;
  /** Already resolved: falls back to "Address shared after you RSVP" when blank. */
  locationLabel: string;
  description?: string | null;
  hostName: string;
  hostAvatarUrl?: string | null;
  coverImageUrl?: string | null;
};

/**
 * The Discover card. Every text block wraps to as many lines as it needs: no
 * numberOfLines, no fixed heights on text, and text beside an icon or chip
 * uses flex:1 / flexShrink:1 so it can never push past the card edge.
 */
export const FoyerGatheringCard = ({
  title,
  audienceLabel,
  goingLabel,
  timeLabel,
  locationLabel,
  description,
  hostName,
  hostAvatarUrl,
  coverImageUrl,
}: FoyerGatheringCardProps) => (
  <View style={styles.card}>
    <View style={styles.photoWrap}>
      {coverImageUrl ? <Image source={{ uri: coverImageUrl }} style={styles.photo} /> : <View style={styles.photo} />}
      <View style={styles.coverBadge}>
        <Text maxFontSizeMultiplier={TIGHT_CHROME_MAX_FONT_SCALE} style={styles.coverBadgeText}>
          Cover photo
        </Text>
      </View>
    </View>
    <View style={styles.body}>
      <View style={styles.chipRow}>
        <View style={styles.audienceChip}>
          <Text maxFontSizeMultiplier={TIGHT_CHROME_MAX_FONT_SCALE} style={styles.audienceChipText}>
            {audienceLabel}
          </Text>
        </View>
        <Text style={styles.goingCount}>{goingLabel}</Text>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <View style={styles.metaRow}>
        <MaterialCommunityIcons name="calendar-blank-outline" size={18} color={appColors.mutedInk} style={styles.metaIcon} />
        <Text style={styles.metaText}>{timeLabel}</Text>
      </View>
      <View style={styles.metaRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={18} color={appColors.mutedInk} style={styles.metaIcon} />
        <Text style={styles.metaText}>{locationLabel}</Text>
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      <View style={styles.hostedRow}>
        {hostAvatarUrl ? (
          <Image source={{ uri: hostAvatarUrl }} style={styles.hostAvatar} />
        ) : (
          <View style={styles.hostAvatar}>
            <Text style={styles.hostInitial}>{hostName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.hostCopy}>
          <Text style={styles.hostedLabel}>Hosted by</Text>
          <Text style={styles.hostedName}>{hostName}</Text>
        </View>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: appColors.white,
    borderRadius: radii.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  photoWrap: { height: 210, backgroundColor: '#c4b2a8' },
  photo: { width: '100%', height: 210, backgroundColor: '#c4b2a8' },
  coverBadge: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    backgroundColor: 'rgba(20,14,16,0.6)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coverBadgeText: { color: appColors.white, fontSize: 12, fontFamily: appTypography.bodyMedium },
  body: { padding: 16, gap: 8 },
  chipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  audienceChip: {
    flexShrink: 1,
    backgroundColor: appColors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  audienceChipText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 13 },
  goingCount: { flexShrink: 1, color: appColors.mutedInk, fontFamily: appTypography.bodyMedium, fontSize: 14 },
  title: { fontFamily: appTypography.heading, fontSize: 25, lineHeight: 34, color: appColors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  metaIcon: { marginTop: 2 },
  metaText: { flex: 1, color: appColors.ink, fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22 },
  description: { color: appColors.ink, fontFamily: appTypography.bodyRegular, fontSize: 15, lineHeight: 22 },
  hostedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.line,
  },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: appColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInitial: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  hostCopy: { flex: 1 },
  hostedLabel: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 12 },
  hostedName: { color: appColors.ink, fontFamily: appTypography.bodySemibold, fontSize: 15, lineHeight: 20 },
});
