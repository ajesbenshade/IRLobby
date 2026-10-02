/** Pure date/time helpers for the shared date picker and the Host form. No React, no native modules. */

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const pad2 = (value: number) => String(value).padStart(2, '0');

/** A calendar day with no time zone attached. `month` is 1-12. */
export type DayValue = { year: number; month: number; day: number };
export type MonthValue = { year: number; month: number };

export const todayValue = (now = new Date()): DayValue => ({
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  day: now.getDate(),
});

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** 0 = Sunday. */
export const firstWeekday = (year: number, month: number) => new Date(year, month - 1, 1).getDay();

export const compareDays = (a: DayValue, b: DayValue) =>
  a.year !== b.year ? a.year - b.year : a.month !== b.month ? a.month - b.month : a.day - b.day;

export const compareMonths = (a: MonthValue, b: MonthValue) =>
  a.year !== b.year ? a.year - b.year : a.month - b.month;

export const addMonths = (value: MonthValue, delta: number): MonthValue => {
  const index = value.year * 12 + (value.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

export const clampDay = (value: DayValue, min: DayValue, max: DayValue): DayValue =>
  compareDays(value, min) < 0 ? min : compareDays(value, max) > 0 ? max : value;

export const toIsoDate = (value: DayValue) => `${value.year}-${pad2(value.month)}-${pad2(value.day)}`;

export const parseIsoDate = (iso: string | null | undefined): DayValue | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) {
    return null;
  }
  const value = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (value.month < 1 || value.month > 12 || value.day < 1 || value.day > daysInMonth(value.year, value.month)) {
    return null;
  }
  return value;
};

/** `Wed, Oct 14, 2026` (Host date field). */
export const formatDayLong = (value: DayValue) => {
  const weekday = WEEKDAY_SHORT[new Date(value.year, value.month - 1, value.day).getDay()];
  return `${weekday}, ${MONTH_SHORT[value.month - 1]} ${value.day}, ${value.year}`;
};

/** `Mar 4, 1988` (birthdate field). */
export const formatDayShort = (value: DayValue) => `${MONTH_SHORT[value.month - 1]} ${value.day}, ${value.year}`;

/** `March 2012` (family member birth month and year). */
export const formatMonthYear = (value: MonthValue) => `${MONTH_NAMES[value.month - 1]} ${value.year}`;

/** Calendar header, e.g. `October 2026`. */
export const formatMonthHeader = formatMonthYear;

/** Day rows for a month grid: leading nulls pad to the first weekday. */
export const monthGrid = (year: number, month: number): Array<number | null> => {
  const cells: Array<number | null> = Array.from({ length: firstWeekday(year, month) }, () => null);
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
};

export type DayLimits = { min: DayValue; max: DayValue };

/** Host date: past days disabled, at most one year out. */
export const hostDayLimits = (now = new Date()): DayLimits => {
  const min = todayValue(now);
  const max = { year: min.year + 1, month: min.month, day: Math.min(min.day, daysInMonth(min.year + 1, min.month)) };
  return { min, max };
};

/** Birthdate: today at most, 1900 at least. */
export const birthDayLimits = (now = new Date()): DayLimits => ({
  min: { year: 1900, month: 1, day: 1 },
  max: todayValue(now),
});

export const isDayAllowed = (value: DayValue, limits: DayLimits) =>
  compareDays(value, limits.min) >= 0 && compareDays(value, limits.max) <= 0;

/** Month-year wheel limits. */
export const monthLimitsForDays = (limits: DayLimits): { min: MonthValue; max: MonthValue } => ({
  min: { year: limits.min.year, month: limits.min.month },
  max: { year: limits.max.year, month: limits.max.month },
});

export const familyBirthMonthLimits = (now = new Date()) => ({
  min: { year: now.getFullYear() - 18, month: 1 },
  max: { year: now.getFullYear(), month: now.getMonth() + 1 },
});

export const clampMonth = (value: MonthValue, min: MonthValue, max: MonthValue): MonthValue =>
  compareMonths(value, min) < 0 ? min : compareMonths(value, max) > 0 ? max : value;

export const monthsAllowedInYear = (year: number, min: MonthValue, max: MonthValue): number[] =>
  Array.from({ length: 12 }, (_, index) => index + 1).filter(
    (month) => compareMonths({ year, month }, min) >= 0 && compareMonths({ year, month }, max) <= 0,
  );

export const yearsBetween = (min: MonthValue, max: MonthValue): number[] =>
  Array.from({ length: max.year - min.year + 1 }, (_, index) => max.year - index);

/** Birthdate picker opens on the wheel about 30 years back when empty. */
export const defaultBirthMonth = (now = new Date()): MonthValue => ({ year: now.getFullYear() - 30, month: now.getMonth() + 1 });

// ---- Times ---------------------------------------------------------------

export const TIME_STEP_MINUTES = 15;
export const DEFAULT_START_MINUTES = 19 * 60;

/** Minutes after midnight for every 15-minute slot, 12:00 AM to 11:45 PM. */
export const timeSlots = (): number[] =>
  Array.from({ length: (24 * 60) / TIME_STEP_MINUTES }, (_, index) => index * TIME_STEP_MINUTES);

/** `7:00 PM` */
export const formatTimeOfDay = (minutes: number) => {
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${pad2(mins)} ${suffix}`;
};

/** Slots a host can pick for the end time: strictly after the start. */
export const endTimeSlots = (startMinutes: number | null): number[] =>
  timeSlots().filter((slot) => startMinutes == null || slot > startMinutes);

/** Slots allowed for the start time: before the end when one is already chosen. */
export const startTimeSlots = (endMinutes: number | null): number[] =>
  timeSlots().filter((slot) => endMinutes == null || slot < endMinutes);

/** Event start/end as ISO date-times built from a local day and minutes after midnight. */
export const toIsoDateTime = (day: DayValue, minutes: number): string =>
  new Date(day.year, day.month - 1, day.day, Math.floor(minutes / 60), minutes % 60, 0, 0).toISOString();

/** Parse an ISO date-time back into a local day and minutes (used when editing). */
export const fromIsoDateTime = (iso: string | null | undefined): { day: DayValue; minutes: number } | null => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    day: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() },
    minutes: Math.round((date.getHours() * 60 + date.getMinutes()) / TIME_STEP_MINUTES) * TIME_STEP_MINUTES,
  };
};

export const HOST_DATE_REQUIRED = 'Choose a date.';
export const HOST_TIME_REQUIRED = 'Choose a start time.';

/** `Sat, Oct 17 · 6:00 PM` from an ISO date-time (device time zone). */
export const formatGatheringWhen = (iso: string | null | undefined): string => {
  const parsed = iso ? new Date(iso) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return '';
  }
  const day = `${WEEKDAY_SHORT[parsed.getDay()]}, ${MONTH_SHORT[parsed.getMonth()]} ${parsed.getDate()}`;
  return `${day} · ${formatTimeOfDay(parsed.getHours() * 60 + parsed.getMinutes())}`;
};

// ---- Minimum age (accounts are not available under 13) ----

export const MIN_ACCOUNT_AGE = 13;

/** The latest birth date that is already `years` old on `now` (device-local today). Feb 29 clamps to Feb 28. */
export const latestBirthDateForAge = (years: number, now = new Date()): DayValue => {
  const today = todayValue(now);
  const year = today.year - years;
  return { year, month: today.month, day: Math.min(today.day, daysInMonth(year, today.month)) };
};

/** True when someone born on `birth` has not yet turned `minAge` on `now` (turning 13 today is NOT under). */
export const isUnderAge = (birth: DayValue, minAge = MIN_ACCOUNT_AGE, now = new Date()): boolean =>
  compareDays(birth, latestBirthDateForAge(minAge, now)) > 0;

/**
 * Sign-up needs a real birth date that is allowed (1900 to today) and old enough (13+), so the under-13 check
 * cannot be skipped by leaving the field empty.
 */
export const isValidSignUpBirthDate = (iso: string | null | undefined, now = new Date()): boolean => {
  const day = parseIsoDate(iso);
  return day != null && isDayAllowed(day, birthDayLimits(now)) && !isUnderAge(day, MIN_ACCOUNT_AGE, now);
};

/** Family birth month: months after the current month are future, so they cannot be confirmed. */
export const isFutureMonth = (value: MonthValue, now = new Date()): boolean =>
  compareMonths(value, { year: now.getFullYear(), month: now.getMonth() + 1 }) > 0;

/** `Friday, March 4, 1988` (weekday computed from the calendar date). */
export const formatDayWithWeekday = (value: DayValue): string => {
  const weekday = new Date(value.year, value.month - 1, value.day).getDay();
  return `${WEEKDAYS_LONG[weekday]}, ${MONTH_NAMES[value.month - 1]} ${value.day}, ${value.year}`;
};

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// ---- Family member birthdays (children under 18) ----

/** `March 4, 2016` (family Birthday field and rows). */
export const formatBirthdayLong = (value: DayValue) => `${MONTH_NAMES[value.month - 1]} ${value.day}, ${value.year}`;

/** The day after `value`. */
export const nextDay = (value: DayValue): DayValue => {
  const date = new Date(value.year, value.month - 1, value.day + 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
};

/**
 * Child birthday range: the last 18 years, no future dates. A day is out of range when that person would already be 18
 * (turning 18 today is already an adult), so the earliest allowed day is the day after the 18th birthday cut-off.
 */
export const familyBirthDayLimits = (now = new Date()): DayLimits => ({
  min: nextDay(latestBirthDateForAge(18, now)),
  max: todayValue(now),
});

/** Day limits for adding the missing day to a saved month and year. */
export const dayLimitsWithinMonth = (month: MonthValue, now = new Date()): DayLimits => {
  const outer = familyBirthDayLimits(now);
  const first: DayValue = { year: month.year, month: month.month, day: 1 };
  const last: DayValue = { year: month.year, month: month.month, day: daysInMonth(month.year, month.month) };
  return {
    min: compareDays(first, outer.min) < 0 ? outer.min : first,
    max: compareDays(last, outer.max) > 0 ? outer.max : last,
  };
};
