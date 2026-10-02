import {
  DEFAULT_START_MINUTES,
  birthDayLimits,
  endTimeSlots,
  familyBirthMonthLimits,
  formatDayLong,
  formatDayShort,
  formatGatheringWhen,
  formatMonthYear,
  formatTimeOfDay,
  fromIsoDateTime,
  hostDayLimits,
  isDayAllowed,
  monthGrid,
  parseIsoDate,
  startTimeSlots,
  timeSlots,
  toIsoDate,
  toIsoDateTime,
} from '../dates';

const NOW = new Date(2026, 9, 1, 12, 0, 0);

describe('date picker limits', () => {
  it('host dates: past days disabled and at most one year out', () => {
    const limits = hostDayLimits(NOW);
    expect(isDayAllowed({ year: 2026, month: 9, day: 30 }, limits)).toBe(false);
    expect(isDayAllowed({ year: 2026, month: 10, day: 1 }, limits)).toBe(true);
    expect(isDayAllowed({ year: 2027, month: 10, day: 1 }, limits)).toBe(true);
    expect(isDayAllowed({ year: 2027, month: 10, day: 2 }, limits)).toBe(false);
  });

  it('birthdates: max today, min 1900', () => {
    const limits = birthDayLimits(NOW);
    expect(isDayAllowed({ year: 1899, month: 12, day: 31 }, limits)).toBe(false);
    expect(isDayAllowed({ year: 1900, month: 1, day: 1 }, limits)).toBe(true);
    expect(isDayAllowed({ year: 2026, month: 10, day: 1 }, limits)).toBe(true);
    expect(isDayAllowed({ year: 2026, month: 10, day: 2 }, limits)).toBe(false);
  });

  it('family birth month: max is this month', () => {
    expect(familyBirthMonthLimits(NOW).max).toEqual({ year: 2026, month: 10 });
  });
});

describe('date formats', () => {
  it('formats the three field styles', () => {
    expect(formatDayShort({ year: 1988, month: 3, day: 4 })).toBe('Mar 4, 1988');
    expect(formatMonthYear({ year: 2012, month: 3 })).toBe('March 2012');
    expect(formatDayLong({ year: 2026, month: 10, day: 14 })).toBe('Wed, Oct 14, 2026');
  });

  it('round-trips ISO dates and rejects impossible ones', () => {
    expect(toIsoDate({ year: 1988, month: 3, day: 4 })).toBe('1988-03-04');
    expect(parseIsoDate('1988-03-04')).toEqual({ year: 1988, month: 3, day: 4 });
    expect(parseIsoDate('1988-02-31')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });

  it('builds a month grid padded to whole weeks', () => {
    const cells = monthGrid(2026, 10);
    expect(cells.length % 7).toBe(0);
    expect(cells.filter((cell) => cell != null)).toHaveLength(31);
    expect(cells[0]).toBeNull();
    expect(cells[4]).toBe(1);
  });
});

describe('time slots', () => {
  it('uses 15-minute steps and defaults the start to 7:00 PM', () => {
    const slots = timeSlots();
    expect(slots).toHaveLength(96);
    expect(slots[1] - slots[0]).toBe(15);
    expect(DEFAULT_START_MINUTES).toBe(19 * 60);
    expect(formatTimeOfDay(DEFAULT_START_MINUTES)).toBe('7:00 PM');
    expect(formatTimeOfDay(0)).toBe('12:00 AM');
    expect(formatTimeOfDay(12 * 60 + 15)).toBe('12:15 PM');
  });

  it('end must be after start and start before end', () => {
    expect(endTimeSlots(19 * 60)[0]).toBe(19 * 60 + 15);
    expect(startTimeSlots(19 * 60).every((slot) => slot < 19 * 60)).toBe(true);
    expect(endTimeSlots(null)).toHaveLength(96);
  });

  it('sends the start as an ISO date-time and parses it back', () => {
    const iso = toIsoDateTime({ year: 2026, month: 11, day: 7 }, 17 * 60 + 30);
    expect(iso).toMatch(/^2026-11-0[78]T\d{2}:30:00\.000Z$/);
    const back = fromIsoDateTime(iso);
    expect(back?.day).toEqual({ year: 2026, month: 11, day: 7 });
    expect(back?.minutes).toBe(17 * 60 + 30);
    expect(formatGatheringWhen(iso)).toBe('Sat, Nov 7 · 5:30 PM');
  });
});

describe('age and month rules', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const d = require('../dates') as typeof import('../dates');
  const now = new Date(2026, 9, 2, 9, 0, 0);

  it('turning 13 today is allowed; a day younger is under', () => {
    expect(d.isUnderAge({ year: 2013, month: 10, day: 2 }, 13, now)).toBe(false);
    expect(d.isUnderAge({ year: 2013, month: 10, day: 3 }, 13, now)).toBe(true);
    expect(d.isUnderAge({ year: 2000, month: 1, day: 1 }, 13, now)).toBe(false);
  });

  it('clamps Feb 29 to Feb 28 in non-leap years', () => {
    expect(d.latestBirthDateForAge(13, new Date(2028, 1, 29))).toEqual({ year: 2015, month: 2, day: 28 });
  });

  it('flags later months as future and formats weekdays', () => {
    expect(d.isFutureMonth({ year: 2026, month: 11 }, now)).toBe(true);
    expect(d.isFutureMonth({ year: 2026, month: 10 }, now)).toBe(false);
    expect(d.formatDayWithWeekday({ year: 1988, month: 3, day: 4 })).toBe('Friday, March 4, 1988');
  });
});
