import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Checkbox } from '@components/foyer/Choice';
import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { Switch } from '@components/foyer/Switch';
import { View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import { PRAYER_COPY, selectedCircleLabel, type PrayerCircle } from '@shared/prayer';

type Props = {
  circles: PrayerCircle[];
  selectedIds: Array<number | string>;
  onChangeSelected: (ids: Array<number | string>) => void;
  wholeChurch: boolean;
  onChangeWholeChurch: (value: boolean) => void;
  circlesStatus: 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';
};

/** Circle picker plus the whole-church toggle. The toggle starts off. */
export const PrayerVisibilityFields = ({
  circles,
  selectedIds,
  onChangeSelected,
  wholeChurch,
  onChangeWholeChurch,
  circlesStatus,
}: Props) => {
  const [open, setOpen] = useState(false);

  const toggle = (id: number | string) => {
    const exists = selectedIds.some((selected) => String(selected) === String(id));
    onChangeSelected(exists ? selectedIds.filter((selected) => String(selected) !== String(id)) : [...selectedIds, id]);
  };

  return (
    <View style={styles.block}>
      <Text style={styles.section}>{PRAYER_COPY.whoCanSee}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${PRAYER_COPY.visibleTo} ${selectedCircleLabel(circles, selectedIds)}`}
        onPress={() => setOpen(true)}
        style={styles.row}
        testID="prayer-circle-picker"
      >
        <MaterialCommunityIcons name="account-outline" size={22} color={appColors.mutedInk} />
        <Text style={styles.visible}>{PRAYER_COPY.visibleTo}</Text>
        <Text style={styles.choice} numberOfLines={1}>
          {selectedCircleLabel(circles, selectedIds)}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={22} color={appColors.mutedInk} />
      </Pressable>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{PRAYER_COPY.wholeChurchToggle}</Text>
        <Switch
          value={wholeChurch}
          onValueChange={onChangeWholeChurch}
          accessibilityLabel={PRAYER_COPY.wholeChurchToggle}
          testID="prayer-whole-church"
        />
      </View>
      <Text style={styles.helper}>{wholeChurch ? PRAYER_COPY.wholeChurchOn : PRAYER_COPY.wholeChurchOff}</Text>
      <FoyerSheet visible={open} onDismiss={() => setOpen(false)}>
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          {PRAYER_COPY.visibleTo}
        </Text>
        {circlesStatus === 'loading' ? <Text style={styles.helper}>{PRAYER_COPY.circlesLoading}</Text> : null}
        {circlesStatus === 'empty' || circlesStatus === 'unavailable' ? (
          <Text style={styles.helper}>{PRAYER_COPY.circlesEmpty}</Text>
        ) : null}
        {circlesStatus === 'error' ? <Text style={styles.helper}>{PRAYER_COPY.circlesFailed}</Text> : null}
        {circles.map((circle) => {
          const selected = selectedIds.some((id) => String(id) === String(circle.id));
          return (
            <Pressable
              key={String(circle.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggle(circle.id)}
              style={styles.circleRow}
            >
              <Checkbox checked={selected} />
              <Text style={styles.circleName}>{circle.name}</Text>
            </Pressable>
          );
        })}
      </FoyerSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
  section: { fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink, marginTop: 8 },
  row: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: appColors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visible: { color: appColors.ink, fontFamily: appTypography.bodyRegular, fontSize: 16 },
  choice: { flex: 1, textAlign: 'right', color: appColors.ink, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  toggleRow: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: appColors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleLabel: { flex: 1, fontFamily: appTypography.bodySemibold, fontSize: 16, color: appColors.ink },
  helper: { color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20 },
  sheetTitle: { fontFamily: appTypography.heading, fontSize: 28, lineHeight: 34, color: appColors.ink, marginBottom: 8 },
  circleRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleName: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 17, color: appColors.ink },
});
