import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, PICKER_COPY } from '@constants/foyerCopy';
import { formatTimeOfDay } from '@foyer/dates';
import { useSheetBottomPadding } from '@navigation/tabBarLayout';
import { appColors, appTypography, radii } from '@theme/index';

type TimePickerSheetProps = {
  visible: boolean;
  title: string;
  /** Minutes after midnight for each choice (already limited to the allowed range). */
  slots: number[];
  value: number | null;
  /** Used to centre the list and as the pending choice when `value` is empty. */
  defaultValue?: number;
  /** End time only: adds a `No end time` row at the top that clears the value. */
  allowNone?: boolean;
  onCancel: () => void;
  onDone: (minutes: number | null) => void;
};

const ROW = 52;

/** Dropdown sheet of 15-minute steps with Cancel and Done. Opens centred on the chosen time. */
export const TimePickerSheet = ({
  visible,
  title,
  slots,
  value,
  defaultValue,
  allowNone = false,
  onCancel,
  onDone,
}: TimePickerSheetProps) => {
  const bottomPadding = useSheetBottomPadding();
  const { height } = useWindowDimensions();
  const [pending, setPending] = useState<number | null>(value ?? defaultValue ?? null);
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const start = value ?? defaultValue ?? null;
    setPending(start);
    const index = start == null ? 0 : Math.max(0, slots.indexOf(start));
    const id = setTimeout(
      () => ref.current?.scrollTo({ y: Math.max(0, (index + (allowNone ? 1 : 0) - 2) * ROW), animated: false }),
      0,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable accessibilityLabel={COMMON_COPY.cancel} style={styles.scrim} onPress={onCancel}>
        <Pressable
          style={[styles.sheet, { maxHeight: Math.round(height * 0.8), paddingBottom: bottomPadding }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <ScrollView ref={ref} style={styles.list} showsVerticalScrollIndicator={false}>
            {allowNone ? (
              <Row label={PICKER_COPY.noEndTime} selected={pending == null} onPress={() => setPending(null)} />
            ) : null}
            {slots.map((slot) => (
              <Row key={slot} label={formatTimeOfDay(slot)} selected={pending === slot} onPress={() => setPending(slot)} />
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" accessibilityLabel={COMMON_COPY.cancel} onPress={onCancel} style={styles.cancel}>
              <Text style={styles.cancelText}>{COMMON_COPY.cancel}</Text>
            </Pressable>
            <PillButton
              label={COMMON_COPY.done}
              disabled={pending == null && !allowNone}
              onPress={() => onDone(pending)}
              style={styles.done}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const Row = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected }}
    onPress={onPress}
    style={[styles.row, selected ? styles.rowSelected : null]}
  >
    <Text style={[styles.rowText, selected ? styles.rowTextSelected : null]}>{label}</Text>
    {selected ? <MaterialCommunityIcons name="check" size={20} color={appColors.primary} /> : null}
  </Pressable>
);

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20, 14, 16, 0.42)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: appColors.white,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 999, backgroundColor: appColors.line, marginBottom: 10 },
  title: { fontFamily: appTypography.heading, fontSize: 24, lineHeight: 32, color: appColors.ink, marginBottom: 8 },
  list: { flexGrow: 0 },
  row: {
    minHeight: ROW,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowSelected: { backgroundColor: appColors.primarySoft },
  rowText: { fontFamily: appTypography.bodyRegular, fontSize: 17, color: appColors.ink },
  rowTextSelected: { fontFamily: appTypography.bodySemibold, color: appColors.primary },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  cancel: { minHeight: 54, minWidth: 80, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  cancelText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  done: { flex: 1 },
});
