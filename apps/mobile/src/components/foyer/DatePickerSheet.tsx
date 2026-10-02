import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';

import { PillButton } from '@components/foyer/ui';
import { View } from '@components/RNCompat';
import { COMMON_COPY, PICKER_COPY } from '@constants/foyerCopy';
import {
  MIN_ACCOUNT_AGE,
  MONTH_NAMES,
  addMonths,
  clampMonth,
  compareDays,
  compareMonths,
  defaultBirthMonth,
  formatDayWithWeekday,
  formatMonthHeader,
  isDayAllowed,
  isFutureMonth,
  isUnderAge,
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
 * Shared pop-out date picker (bottom sheet). Every mode has a text Cancel/Back on the left
 * and a filled burgundy 54pt pill on the right. Built as a small JS sheet instead of
 * @react-native-community/datetimepicker so it ships over the air: no new native module.
 *
 *  - day:        calendar grid; header opens the month/year wheel; Done writes the day.
 *  - birthdate:  wheel step (Cancel + Next) -> day grid step (Back + Confirm). Confirm stays
 *                disabled until a day is picked and while the person would be under 13.
 *  - monthYear:  wheel only (Cancel + Confirm). Months after the current month are greyed and
 *                cannot be confirmed (family birth month and year).
 */
export type DatePickerMode = 'day' | 'birthdate' | 'monthYear';

type CommonProps = {
  visible: boolean;
  title: string;
  onCancel: () => void;
  /** Test seam: "today" for the age check and the future-month rule. Defaults to the device clock. */
  now?: Date;
};

type DayProps = CommonProps & {
  mode: 'day' | 'birthdate';
  value: DayValue | null;
  limits: DayLimits;
  onDone: (value: DayValue) => void;
  /** Birth date only. Default 13. */
  minAge?: number;
};

type MonthProps = CommonProps & {
  mode: 'monthYear';
  value: MonthValue | null;
  limits: { min: MonthValue; max: MonthValue };
  onDone: (value: MonthValue) => void;
};

export type DatePickerSheetProps = DayProps | MonthProps;

export const WHEEL_ROW_HEIGHT = 48;
export const PICKER_ROW_MIN = 48;

const dayLimitsOf = (props: DatePickerSheetProps) =>
  props.mode === 'monthYear' ? { min: props.limits.min, max: props.limits.max } : monthLimitsForDays(props.limits);

type Step = 'grid' | 'wheel';

export const DatePickerSheet = (props: DatePickerSheetProps) => {
  const { visible, title, onCancel, mode } = props;
  const now = props.now ?? new Date();
  const bottomPadding = useSheetBottomPadding();
  const { height } = useWindowDimensions();
  const monthLimits = useMemo(
    () => dayLimitsOf(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, props.limits],
  );
  const firstStep: Step = mode === 'day' ? 'grid' : 'wheel';

  const seedMonth = (): MonthValue => {
    const base: MonthValue =
      props.value != null
        ? { year: props.value.year, month: props.value.month }
        : mode === 'birthdate'
          ? defaultBirthMonth(now)
          : mode === 'monthYear'
            ? monthLimits.max
            : monthLimits.min;
    return mode === 'monthYear' ? clampMonth(base, monthLimits.min, { year: monthLimits.max.year, month: 12 }) : clampMonth(base, monthLimits.min, monthLimits.max);
  };

  const [step, setStep] = useState<Step>(firstStep);
  const [month, setMonth] = useState<MonthValue>(seedMonth);
  const [selectedDay, setSelectedDay] = useState<DayValue | null>(
    mode === 'monthYear' ? null : ((props.value as DayValue | null) ?? null),
  );

  // Re-seed whenever the sheet is opened again.
  useEffect(() => {
    if (visible) {
      setStep(firstStep);
      setMonth(seedMonth());
      setSelectedDay(mode === 'monthYear' ? null : ((props.value as DayValue | null) ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const minAge = props.mode === 'birthdate' ? (props.minAge ?? MIN_ACCOUNT_AGE) : null;
  const underAge = props.mode === 'birthdate' && selectedDay != null && minAge != null && isUnderAge(selectedDay, minAge, now);
  const futureMonth = mode === 'monthYear' && isFutureMonth(month, now);

  const confirm = () => {
    if (props.mode === 'monthYear') {
      if (!futureMonth) {
        props.onDone({ year: month.year, month: month.month });
      }
      return;
    }
    if (selectedDay && isDayAllowed(selectedDay, props.limits) && !underAge) {
      props.onDone(selectedDay);
    }
  };

  const gridDisabled = selectedDay == null || (props.mode !== 'monthYear' && !isDayAllowed(selectedDay, props.limits)) || underAge;

  // Left (text) and right (filled pill) actions per mode and step.
  let leftLabel: string = COMMON_COPY.cancel;
  let leftAction: () => void = onCancel;
  let rightLabel: string = COMMON_COPY.done;
  let rightAction: () => void = confirm;
  let rightDisabled = false;
  if (mode === 'birthdate') {
    if (step === 'wheel') {
      rightLabel = PICKER_COPY.next;
      rightAction = () => setStep('grid');
    } else {
      leftLabel = PICKER_COPY.back;
      leftAction = () => setStep('wheel');
      rightLabel = PICKER_COPY.confirm;
      rightDisabled = gridDisabled;
    }
  } else if (mode === 'monthYear') {
    rightLabel = PICKER_COPY.confirm;
    rightDisabled = futureMonth;
  } else {
    rightDisabled = gridDisabled;
  }

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
            {step === 'wheel' ? (
              <>
                {mode !== 'day' ? (
                  <Text style={styles.helper}>{mode === 'birthdate' ? PICKER_COPY.birthWheelHelper : PICKER_COPY.monthYearHelper}</Text>
                ) : null}
                <MonthYearWheel
                  value={month}
                  min={monthLimits.min}
                  max={monthLimits.max}
                  onChange={setMonth}
                  allowFuture={mode === 'monthYear'}
                  now={now}
                />
                {futureMonth ? <Text style={styles.futureNote}>{PICKER_COPY.pickPastMonth}</Text> : null}
              </>
            ) : (
              <>
                {mode === 'birthdate' && underAge ? (
                  <View style={styles.underAge} accessibilityRole="alert" testID="picker-under13">
                    <MaterialCommunityIcons name="alert-circle-outline" size={20} color={ERROR_INK} />
                    <Text style={styles.underAgeText}>{PICKER_COPY.under13}</Text>
                  </View>
                ) : mode === 'birthdate' ? (
                  <Text accessibilityLiveRegion="polite" style={[styles.readout, selectedDay ? null : styles.readoutEmpty]}>
                    {selectedDay ? formatDayWithWeekday(selectedDay) : PICKER_COPY.pickADay}
                  </Text>
                ) : null}
                <DayGrid
                  month={month}
                  limits={props.mode === 'monthYear' ? null : props.limits}
                  selected={selectedDay}
                  weekdays={mode === 'birthdate' ? PICKER_COPY.weekdaysLong : PICKER_COPY.weekdays}
                  onMonthChange={setMonth}
                  onHeaderPress={() => setStep('wheel')}
                  onSelect={setSelectedDay}
                  now={now}
                />
                {mode === 'birthdate' ? <Text style={styles.caption}>{PICKER_COPY.birthCaption}</Text> : null}
              </>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable accessibilityRole="button" accessibilityLabel={leftLabel} onPress={leftAction} style={styles.cancel}>
              <Text style={styles.cancelText}>{leftLabel}</Text>
            </Pressable>
            <PillButton label={rightLabel} onPress={rightAction} disabled={rightDisabled} style={styles.done} testID="picker-confirm" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const ERROR_INK = '#8a0a1f';

type DayGridProps = {
  month: MonthValue;
  limits: DayLimits | null;
  selected: DayValue | null;
  onMonthChange: (month: MonthValue) => void;
  onHeaderPress: () => void;
  onSelect: (day: DayValue) => void;
  weekdays?: readonly string[];
  now?: Date;
};

export const DayGrid = ({ month, limits, selected, onMonthChange, onHeaderPress, onSelect, weekdays = PICKER_COPY.weekdays, now }: DayGridProps) => {
  const cells = monthGrid(month.year, month.month);
  const limitMonths = limits ? monthLimitsForDays(limits) : null;
  const canPrev = !limitMonths || compareMonths(addMonths(month, -1), limitMonths.min) >= 0;
  const canNext = !limitMonths || compareMonths(addMonths(month, 1), limitMonths.max) <= 0;
  const today = useMemo(() => {
    const base = now ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() + 1, day: base.getDate() };
  }, [now]);

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
          <MaterialCommunityIcons name="chevron-down" size={22} color={appColors.primary} />
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
        {weekdays.map((label, index) => (
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
  /** Family birth month: later months of the last year stay tappable but greyed (Confirm is disabled for them). */
  allowFuture?: boolean;
  now?: Date;
};

/** Month and year columns. Rows are 44pt, tap to choose, scrolls to the chosen row on open. */
export const MonthYearWheel = ({ value, min, max, onChange, allowFuture = false, now }: WheelProps) => {
  const years = useMemo(() => yearsBetween(min, max), [min, max]);
  const allowedMonths = allowFuture ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : monthsAllowedInYear(value.year, min, max);

  const chooseYear = (year: number) => {
    onChange(allowFuture ? clampMonth({ year, month: value.month }, min, { year: max.year, month: 12 }) : clampMonth({ year, month: value.month }, min, max));
  };

  return (
    <View style={styles.wheelRow}>
      <WheelColumn
        label="Month"
        items={MONTH_NAMES.map((name, index) => ({
          key: index + 1,
          label: name,
          disabled: !allowedMonths.includes(index + 1),
          muted: allowFuture && isFutureMonth({ year: value.year, month: index + 1 }, now),
        }))}
        selectedKey={value.month}
        onSelect={(key) => onChange({ year: value.year, month: Number(key) })}
      />
      <WheelColumn
        label="Year"
        items={years.map((year) => ({ key: year, label: String(year), disabled: false, muted: false }))}
        selectedKey={value.year}
        onSelect={(key) => chooseYear(Number(key))}
      />
    </View>
  );
};

type WheelItem = { key: number; label: string; disabled: boolean; muted?: boolean };

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
              <Text style={[styles.wheelText, selected ? styles.wheelTextSelected : null, item.disabled || item.muted ? styles.dayDisabled : null]}>
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
  /** Server-side rejection: dark red outline and an alert icon on the message. */
  errorStrong?: boolean;
  onPress: () => void;
  testID?: string;
};

/** 54pt tap-only row with the label above. It never opens the keyboard. */
export const PickerField = ({ label, value, placeholder, icon = 'calendar-month-outline', error, errorStrong, onPress, testID }: DateFieldProps) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `, ${value}` : ''}`}
      testID={testID}
      onPress={onPress}
      style={[styles.fieldRow, error ? (errorStrong ? styles.fieldRowStrongError : styles.fieldRowError) : null]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={appColors.primary} />
      <Text style={[styles.fieldValue, !value ? styles.fieldPlaceholder : null]}>{value || placeholder || ''}</Text>
      <MaterialCommunityIcons name="chevron-down" size={20} color={appColors.mutedInk} />
    </Pressable>
    {error ? (
      <View style={styles.fieldErrorRow} accessibilityRole="alert">
        {errorStrong ? <MaterialCommunityIcons name="alert-circle-outline" size={18} color={ERROR_INK} /> : null}
        <Text style={[styles.fieldError, errorStrong ? { color: ERROR_INK } : null]}>{error}</Text>
      </View>
    ) : null}
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
  chevron: { minWidth: 48, minHeight: 48, borderRadius: 24, backgroundColor: appColors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  monthHeader: {
    flex: 1,
    minHeight: 48,
    marginHorizontal: 8,
    borderRadius: 24,
    backgroundColor: appColors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  monthHeaderText: { fontFamily: appTypography.heading, fontSize: 18, lineHeight: 26, color: appColors.primary, textAlign: 'center' },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: appColors.mutedInk, fontFamily: appTypography.bodySemibold, fontSize: 12 },
  dayWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1.5, borderColor: appColors.primary },
  daySelected: { backgroundColor: appColors.primary },
  dayText: { color: appColors.ink, fontFamily: appTypography.bodyMedium, fontSize: 16 },
  dayDisabled: { color: '#cec8c4' },
  daySelectedText: { color: '#ffffff', fontFamily: appTypography.bodySemibold },
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
  fieldRowStrongError: { borderColor: ERROR_INK, borderWidth: 2 },
  fieldErrorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  helper: { fontFamily: appTypography.bodyRegular, fontSize: 14, lineHeight: 20, color: appColors.mutedInk, marginBottom: 10 },
  readout: { fontFamily: appTypography.bodySemibold, fontSize: 17, lineHeight: 24, color: appColors.ink, textAlign: 'center', marginBottom: 4 },
  readoutEmpty: { color: appColors.softInk },
  caption: { fontFamily: appTypography.bodyRegular, fontSize: 13, lineHeight: 18, color: appColors.mutedInk, marginTop: 10 },
  futureNote: { fontFamily: appTypography.bodyMedium, fontSize: 13, lineHeight: 18, color: appColors.mutedInk, marginTop: 10, textAlign: 'center' },
  underAge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#fde8e8',
  },
  underAgeText: { flex: 1, color: ERROR_INK, fontFamily: appTypography.bodySemibold, fontSize: 14, lineHeight: 20 },
  fieldError: { color: appColors.primary, fontFamily: appTypography.bodyMedium, fontSize: 13, lineHeight: 18 },
});
