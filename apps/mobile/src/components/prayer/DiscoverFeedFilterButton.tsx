import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FoyerSheet } from '@components/foyer/FoyerSheet';
import { View } from '@components/RNCompat';
import { appColors, appTypography } from '@theme/index';
import { DISCOVER_FEED_FILTERS, PRAYER_COPY, discoverFeedLabel, type DiscoverFeedFilter } from '@shared/prayer';

type Props = {
  value: DiscoverFeedFilter;
  onChange: (value: DiscoverFeedFilter) => void;
};

/** "Gatherings and prayer" pill and the Show on Discover sheet. */
export const DiscoverFeedFilterButton = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const label = discoverFeedLabel(value);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={styles.pill}
        testID="discover-feed-filter"
      >
        <Text style={styles.pillText}>{label}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={appColors.ink} />
      </Pressable>
      <FoyerSheet visible={open} onDismiss={() => setOpen(false)}>
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          {PRAYER_COPY.filterTitle}
        </Text>
        {DISCOVER_FEED_FILTERS.map((option, index) => {
          const selected = option.id === value;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                onChange(option.id);
                setOpen(false);
              }}
              style={[styles.row, index < DISCOVER_FEED_FILTERS.length - 1 ? styles.rowDivider : null]}
            >
              <Text style={styles.rowLabel}>{option.label}</Text>
              {selected ? (
                <View style={styles.check}>
                  <MaterialCommunityIcons name="check" size={16} color={appColors.white} />
                </View>
              ) : (
                <View style={styles.empty} />
              )}
            </Pressable>
          );
        })}
        <Text style={styles.note}>{PRAYER_COPY.filterFootnote}</Text>
      </FoyerSheet>
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: appColors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: appColors.line,
  },
  pillText: { fontFamily: appTypography.bodySemibold, fontSize: 15, color: appColors.ink },
  sheetTitle: {
    fontFamily: appTypography.heading,
    fontSize: 28,
    lineHeight: 34,
    color: appColors.ink,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: appColors.line },
  rowLabel: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 17, color: appColors.ink },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: appColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#c8beba',
    backgroundColor: appColors.white,
  },
  note: { marginTop: 16, color: appColors.mutedInk, fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20 },
});
