import { StyleSheet, Text } from 'react-native';

import { View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import {
  chipLabels,
  personInitials,
  postedByLine,
  prayingLabel,
  previewDetails,
  PRAYER_COPY,
  type PrayerRequest,
} from '@shared/prayer';

const AVATAR_TINTS = ['#f3c1d0', '#e7b4c6', '#f7d5e0', '#edd0da'];

type PrayerCardProps = {
  prayer: PrayerRequest;
  /** Discover truncates details. Detail shows the full note. */
  full?: boolean;
};

export const PrayerCard = ({ prayer, full = false }: PrayerCardProps) => {
  const chips = chipLabels(prayer);
  const details = full ? prayer.details.trim() : previewDetails(prayer.details);
  const prayingInitials = [personInitials(prayer.author.name)];

  return (
    <View style={styles.card}>
      <View style={styles.chips}>
        <View style={styles.prayerChip}>
          <Text style={styles.prayerChipText}>{PRAYER_COPY.prayerChip}</Text>
        </View>
        {chips.map((chip) => (
          <View key={chip} style={styles.neutralChip}>
            <Text style={styles.neutralChipText}>{chip}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.title}>{prayer.title}</Text>
      {details ? <Text style={styles.details}>{details}</Text> : null}
      <View style={styles.footer}>
        <View style={styles.who}>
          <View style={[styles.avatar, { backgroundColor: AVATAR_TINTS[0] }]}>
            <Text style={styles.avatarText}>{personInitials(prayer.author.name)}</Text>
          </View>
          <Text style={styles.posted} numberOfLines={1}>
            {postedByLine(prayer.author.name)}
          </Text>
        </View>
        <View style={styles.praying}>
          <View style={styles.stack}>
            {prayingInitials.map((initial, index) => (
              <View
                key={`${initial}-${index}`}
                style={[styles.stackAvatar, { backgroundColor: AVATAR_TINTS[index % AVATAR_TINTS.length], marginLeft: index === 0 ? 0 : -8 }]}
              >
                <Text style={styles.stackText}>{initial}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.count}>{prayingLabel(prayer.prayingCount)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: appColors.white,
    borderRadius: 22,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    gap: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prayerChip: { backgroundColor: '#f9e8ee', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  prayerChipText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 14 },
  neutralChip: { backgroundColor: '#f3eeeb', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  neutralChipText: { color: appColors.ink, fontFamily: appTypography.bodyMedium, fontSize: 14 },
  title: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 34, color: appColors.ink, fontWeight: '700' },
  details: { fontFamily: appTypography.bodyRegular, fontSize: 16, lineHeight: 22, color: '#5c5856' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: appColors.line,
    paddingTop: 12,
    marginTop: 4,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: appColors.primary, fontSize: 11, fontFamily: appTypography.bodySemibold },
  posted: { flex: 1, color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14 },
  praying: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: appColors.white,
  },
  stackText: { color: appColors.primary, fontSize: 10, fontFamily: appTypography.bodySemibold },
  count: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 15 },
});
