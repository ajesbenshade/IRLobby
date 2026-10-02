import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, PICKER_COPY } from '@constants/foyerCopy';
import {
  MONTH_NAMES,
  addMonths,
  clampMonth,
  compareDays,
  compareMonths,
  defaultBirthMonth,
  formatMonthHeader,
  isDayAllowed,
  monthGrid,
  monthLimitsForDays,
  monthsAllowedInYear,
  yearsBetween,
  type DayLimits,
  type DayValue,
  type MonthValue,
} from '@foyer/dates';
import { useSheetBottomPadding } from '@navigation/tabBarLayout';
import { appColors, appTypography, radii } from '@theme/index';

/**
 * Shared pop-out date picker (bottom sheet, Cancel text button + burgundy Done pill).
 * Built as a small JS sheet instead of @react-native-community/datetimepicker so it
 * ships over the air: no new native module, and Cancel/Done plus the month-header
 * jump to a month/year wheel are exactly the design.
 *
 *  - day:        calendar grid; header opens the month/year wheel; Done writes the day.
 *  - birthdate:  opens on the wheel; first Done moves to the day grid; second Done saves.
 *  - monthYear:  wheel only; Done writes month and year.
 */
export type DatePickerMode = 'day' | 'birthdate' | 'monthYear';

type CommonProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
};

type DayProps = CommonProps & {
  mode: 'day' | 'birthdate';
  value: DayValue | null;
  limits: DayLimits;
  onDone: (value: DayValue) => void;
};

type MonthProps = CommonProps & {
  mode: 'monthYear';
  value: MonthValue | null;
  limits: { min: MonthValue; max: MonthValue };
  onDone: (value: MonthValue) => void;
};

export type DatePickerSheetProps = DayProps | MonthProps;

export const WHEEL_ROW_HEIGHT = 44;

const dayLimitsOf = (props: DatePickerSheetProps) =>
  props.mode === 'monthYear' ? { min: props.limits.min, max: props.limits.max } : monthLimitsForDays(props.limits);

export const DatePickerSheet = (props: DatePickerSheetProps) => {
  const { visible, title, onCancel, mode } = props;
  const bottomPadding = useSheetBottomPadding();
  const { height } = useWindowDimensions();
  const monthLimits = useMemo(
    () => dayLimitsOf(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, props.limits],
  );

  const initialMonth = useMemo<MonthValue>(() => {
    const base: MonthValue =
      props.value != null
        ? { year: props.value.year, month: props.value.month }
        : mode === 'birthdate'
          ? defaultBirthMonth()
          : { ...monthLimits.min, month: monthLimits.min.month };
    const startDefault =
      props.value == null && mode === 'day' ? monthLimits.min : props.value == null && mode === 'monthYear' ? monthLimits.max : base;
    return clampMonth(startDefault, monthLimits.min, monthLimits.max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const [view, setView] = useState<'grid' | 'wheel'>(mode === 'day' ? 'grid' : 'wheel');
  const [month, setMonth] = useState<MonthValue>(initialMonth);
  const [selectedDay, setSelectedDay] = useState<DayValue | null>(
    mode === 'monthYear' ? null : ((props.value as DayValue | null) ?? null),
  );

  // Re-seed whenever the sheet is opened again.
  useEffect(() => {
    if (visible) {
      setView(mode === 'day' ? 'grid' : 'wheel');
      setMonth(initialMonth);
      setSelectedDay(mode === 'monthYear' ? null : ((props.value as DayValue | null) ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const done = () => {
    if (view === 'wheel') {
      if (props.mode === 'monthYear') {
        props.onDone({ year: month.year, month: month.month });
        return;
      }
      // Wheel Done moves to the day grid for that month.
      setView('grid');
      return;
    }
    if (props.mode === 'monthYear') {
      return;
    }
    const day = selectedDay ?? (props.mode === 'day' ? null : null);
    if (day) {
      props.onDone(day);
    }
  };

  const doneDisabled = view === 'grid' && (selectedDay == null || (props.mode !== 'monthYear' && !isDayAllowed(selectedDay, props.limits)));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable accessibilityLabel={COMMON_COPY.cancel} style={styles.scrim} onPress={onCancel}>
        <Pressable
          style={[styles.sheet, { maxHeight: Math.round(height * 0.92), paddingBottom: bottomPadding }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {view === 'wheel' ? (
              <MonthYearWheel value={month} min={monthLimits.min} max={monthLimits.max} onChange={setMonth} />
            ) : (
              <DayGrid
                month={month}
                limits={props.mode === 'monthYear' ? null : props.limits}
                selected={selectedDay}
                onMonthChange={setMonth}
                onHeaderPress={() => setView('wheel')}
                onSelect={setSelectedDay}
              />
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" accessibilityLabel={COMMON_COPY.cancel} onPress={onCancel} style={styles.cancel}>
              <Text style={styles.cancelText}>{COMMON_COPY.cancel}</Text>
            </Pressable>
            <PillButton label={COMMON_COPY.done} onPress={done} disabled={doneDisabled} style={styles.done} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

type DayGridProps = {
  month: MonthValue;
  limits: DayLimits | null;
  selected: DayValue | null;
  onMonthChange: (month: MonthValue) => void;
  onHeaderPress: () => void;
  onSelect: (day: DayValue) => void;
};

export const DayGrid = ({ month, limits, selected, onMonthChange, onHeaderPress, onSelect }: DayGridProps) => {
  const cells = monthGrid(month.year, month.month);
  const limitMonths = limits ? monthLimitsForDays(limits) : null;
  const canPrev = !limitMonths || compareMonths(addMonths(month, -1), limitMonths.min) >= 0;
  const canNext = !limitMonths || compareMonths(addMonths(month, 1), limitMonths.max) <= 0;
  const today = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }, []);

  return (
    <View style={styles.grid}>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PICKER_COPY.previousMonth}
          accessibilityState={{ disabled: !canPrev }}
          disabled={!canPrev}
          onPress={() => onMonthChange(addMonths(month, -1))}
          style={styles.chevron}
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color={canPrev ? appColors.primary : '#cec8c4'} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${formatMonthHeader(month)}. ${PICKER_COPY.chooseMonthYear}`}
          onPress={onHeaderPress}
          style={styles.monthHeader}
        >
          <Text style={styles.monthHeaderText}>{formatMonthHeader(month)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={PICKER_COPY.nextMonth}
          accessibilityState={{ disabled: !canNext }}
          disabled={!canNext}
          onPress={() => onMonthChange(addMonths(month, 1))}
          style={styles.chevron}
        >
          <MaterialCommunityIcons name="chevron-right" size={26} color={canNext ? appColors.primary : '#cec8c4'} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {PICKER_COPY.weekdays.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.dayWrap}>
        {cells.map((day, index) => {
          if (day == null) {
            return <View key={`blank-${index}`} style={styles.dayCell} />;
          }
          const value: DayValue = { year: month.year, month: month.month, day };
          const allowed = !limits || isDayAllowed(value, limits);
          const isSelected = selected != null && compareDays(selected, value) === 0;
          const isToday = compareDays(today, value) === 0;
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${MONTH_NAMES[month.month - 1]} ${day}, ${month.year}`}
              accessibilityState={{ disabled: !allowed, selected: isSelected }}
              disabled={!allowed}
              onPress={() => onSelect(value)}
              style={styles.dayCell}
            >
              <View style={[styles.dayCircle, isToday && !isSelected ? styles.dayToday : null, isSelected ? styles.daySelected : null]}>
                <Text style={[styles.dayText, !allowed ? styles.dayDisabled : null, isSelected ? styles.daySelectedText : null]}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

type WheelProps = {
  value: MonthValue;
  min: MonthValue;
  max: MonthValue;
  onChange: (value: MonthValue) => void;
};

/** Month and year columns. Rows are 44pt, tap to choose, scrolls to the chosen row on open. */
export const MonthYearWheel = ({ value, min, max, onChange }: WheelProps) => {
  const years = useMemo(() => yearsBetween(min, max), [min, max]);
  const allowedMonths = monthsAllowedInYear(value.year, min, max);

  const chooseYear = (year: number) => {
    onChange(clampMonth({ year, month: value.month }, min, max));
  };

  return (
    <View style={styles.wheelRow}>
      <WheelColumn
        label="Month"
        items={MONTH_NAMES.map((name, index) => ({ key: index + 1, label: name, disabled: !allowedMonths.includes(index + 1) }))}
        selectedKey={value.month}
        onSelect={(key) => onChange({ year: value.year, month: Number(key) })}
      />
      <WheelColumn
        label="Year"
        items={years.map((year) => ({ key: year, label: String(year), disabled: false }))}
        selectedKey={value.year}
        onSelect={(key) => chooseYear(Number(key))}
      />
    </View>
  );
};

type WheelItem = { key: number; label: string; disabled: boolean };

const WheelColumn = ({
  label,
  items,
  selectedKey,
  onSelect,
}: {
  label: string;
  items: WheelItem[];
  selectedKey: number;
  onSelect: (key: number) => void;
}) => {
  const ref = useRef<ScrollView>(null);
  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.key === selectedKey),
  );

  useEffect(() => {
    const offset = Math.max(0, (selectedIndex - 2) * WHEEL_ROW_HEIGHT);
    const id = setTimeout(() => ref.current?.scrollTo({ y: offset, animated: false }), 0);
    return () => clearTimeout(id);
    // Only on open; later taps keep the user's scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wheelColumn} accessibilityLabel={label}>
      <ScrollView ref={ref} style={styles.wheelScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const selected = item.key === selectedKey;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${item.label}`}
              accessibilityState={{ selected, disabled: item.disabled }}
              disabled={item.disabled}
              onPress={() => onSelect(item.key)}
              style={[styles.wheelItem, selected ? styles.wheelItemSelected : null]}
            >
              <Text style={[styles.wheelText, selected ? styles.wheelTextSelected : null, item.disabled ? styles.dayDisabled : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

type DateFieldProps = {
  label: string;
  value: string | null;
  placeholder?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  error?: string | null;
  onPress: () => void;
  testID?: string;
};

/** 54pt tap-only row with the label above. It never opens the keyboard. */
export const PickerField = ({ label, value, placeholder, icon = 'calendar-month-outline', error, onPress, testID }: DateFieldProps) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `, ${value}` : ''}`}
      testID={testID}
      onPress={onPress}
      style={[styles.fieldRow, error ? styles.fieldRowError : null]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={appColors.primary} />
      <Text style={[styles.fieldValue, !value ? styles.fieldPlaceholder : null]}>{value || placeholder || ''}</Text>
      <MaterialCommunityIcons name="chevron-down" size={20} color={appColors.mutedInk} />
    </Pressable>
    {error ? <Text style={styles.fieldError}>{error}</Text> : null}
  </View>
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
  body: { paddingBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  cancel: { minHeight: 54, minWidth: 80, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  cancelText: { color: appColors.primary, fontFamily: appTypography.bodySemibold, fontSize: 16 },
  done: { flex: 1 },
  grid: { gap: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  monthHeader: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  monthHeaderText: { fontFamily: appTypography.heading, fontSize: 18, lineHeight: 26, color: appColors.ink, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  dayWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1.5, borderColor: appColors.primary },
  daySelected: { backgroundColor: appColors.primary },
  dayText: { color: appColors.ink, fontFamily: appTypography.bodyMedium, fontSize: 16 },
  dayDisabled: { color: '#cec8c4' },
  daySelectedText: { color: '#f6f1ee', fontFamily: appTypography.bodySemibold },
  wheelRow: { flexDirection: 'row', gap: 12 },
  wheelColumn: { flex: 1 },
  wheelScroll: { height: WHEEL_ROW_HEIGHT * 5 },
  wheelItem: { height: WHEEL_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  wheelItemSelected: { backgroundColor: appColors.primarySoft },
  wheelText: { color: appColors.ink, fontFamily: appTypography.bodyRegular, fontSize: 18 },
  wheelTextSelected: { color: appColors.primary, fontFamily: appTypography.bodySemibold },
  field: { gap: 6 },
  fieldLabel: { fontFamily: appTypography.bodySemibold, fontSize: 13, color: appColors.ink },
  fieldRow: {
    minHeight: 54,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: appColors.line,
    backgroundColor: appColors.white,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldRowError: { borderColor: appColors.primary, borderWidth: 1.8 },
  fieldValue: { flex: 1, fontFamily: appTypography.bodyRegular, fontSize: 16, lineHeight: 22, color: appColors.ink, paddingVertical: 8 },
  fieldPlaceholder: { color: appColors.softInk },
  fieldError: { color: appColors.primary, fontFamily: appTypography.bodyMedium, fontSize: 13, lineHeight: 18 },
});
