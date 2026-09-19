import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Image, ScrollView, View } from '@components/RNCompat';
import { EVENT_PHOTOS_HELPER, MAX_EVENT_PHOTOS } from '@constants/activity';
import { appColors, appTypography, radii, spacing } from '@theme/index';

type EventPhotoSlotsProps = {
  images: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  max?: number;
};

export const EventPhotoSlots = ({
  images,
  onAdd,
  onRemove,
  max = MAX_EVENT_PHOTOS,
}: EventPhotoSlotsProps) => {
  const emptyCount = Math.max(0, max - images.length);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeLabel}>NEW</Text>
        </View>
        <Text style={styles.title}>Photos</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {images.map((uri, index) => (
          <View key={`${index}-${uri.slice(0, 24)}`} style={styles.filledSlot}>
            <Image source={{ uri }} style={styles.thumbnail} accessibilityLabel={`Event photo ${index + 1}`} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              onPress={() => onRemove(index)}
              style={styles.removeBtn}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="close" size={12} color={appColors.white} />
            </Pressable>
          </View>
        ))}
        {Array.from({ length: emptyCount }).map((_, index) => (
          <Pressable
            key={`empty-${index}`}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            onPress={onAdd}
            style={styles.emptySlot}
          >
            <MaterialCommunityIcons name="plus" size={22} color={appColors.primary} />
            <Text style={styles.addLabel}>Add</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.helper}>{EVENT_PHOTOS_HELPER}</Text>
    </View>
  );
};

const SLOT_SIZE = 76;

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newBadge: {
    borderRadius: radii.pill,
    backgroundColor: appColors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeLabel: {
    color: appColors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  title: {
    color: appColors.ink,
    fontFamily: appTypography.bodySemibold,
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  filledSlot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: appColors.cardStrong,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.primary,
  },
  emptySlot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: appColors.white,
  },
  addLabel: {
    color: appColors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  helper: {
    color: appColors.mutedInk,
    fontSize: 13,
    lineHeight: 18,
    paddingBottom: spacing.xs,
  },
});
