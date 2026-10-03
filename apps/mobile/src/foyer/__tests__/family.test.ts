import { FAMILY_COPY } from '@constants/foyerCopy';

import { familyBirthDayLimits } from '../dates';
import {
  ageBandForAge,
  canAddFamilyMember,
  familyEditChanged,
  isAdultBirthdayError,
  isMonthYearOnly,
  isAdultMember,
  memberBirthLine,
  memberInitials,
  normalizeFamilyMembers,
} from '../family';

const now = new Date(2026, 9, 2); // Fri Oct 2, 2026

describe('family members', () => {
  it('reads full dates, legacy month/year rows and legacy spouse rows from the members list', () => {
    const members = normalizeFamilyMembers({
      children: [
        { id: 2, name: 'Caleb', date_of_birth: '2011-06-09', age: 15 },
        { id: 3, name: 'Noah', date_of_birth: null, birth_month: 3, birth_year: 2016, birth_precision: 'month', age: 10 },
      ],
      members: [
        { id: 1, name: 'Rachel', relationship: 'spouse', sex: 'female', birth_month: null, birth_year: null, age: null },
        { id: 2, name: 'Caleb', relationship: 'child', sex: 'male', birth_month: 6, birth_year: 2011, age: 15 },
        { id: 3, name: 'Noah', relationship: 'child', sex: 'male', birth_month: 3, birth_year: 2016, age: 10 },
      ],
    } as never);
    expect(members.map(memberBirthLine)).toEqual(['Adult', 'Born June 9, 2011', 'Born March 2016']);
    expect(isMonthYearOnly(members[2])).toBe(true);
    expect(isMonthYearOnly(members[1])).toBe(false);
    expect(isMonthYearOnly(members[0])).toBe(false);
  });

  it('trusts an explicit day from the server (birth_day) even on the last day of a month', () => {
    const [full, legacy] = normalizeFamilyMembers({
      members: [
        { id: 1, name: 'A', relationship: 'child', birth_month: 3, birth_year: 2016, birth_day: 31, date_of_birth: '2016-03-31' },
        { id: 2, name: 'B', relationship: 'child', birth_month: 3, birth_year: 2016, birth_day: null, birth_precision: 'month', date_of_birth: null },
      ],
    } as never);
    expect(memberBirthLine(full)).toBe('Born March 31, 2016');
    expect(memberBirthLine(legacy)).toBe('Born March 2016');
  });

  it('falls back to the legacy children list', () => {
    const members = normalizeFamilyMembers({ children: [{ id: 4, name: 'Noah', date_of_birth: '2015-06-20', age: 11 }] } as never);
    expect(members).toEqual([expect.objectContaining({ id: 4, relationship: 'child', birth_month: 6, birth_year: 2015, date_of_birth: '2015-06-20' })]);
    expect(memberBirthLine(members[0])).toBe('Born June 20, 2015');
  });

  it('computes age bands', () => {
    expect(ageBandForAge(9)).toBe('Under 13');
    expect(ageBandForAge(15)).toBe('13–17');
    expect(ageBandForAge(30)).toBeNull();
    expect(ageBandForAge(null)).toBeNull();
  });

  it('Add needs a name, a sex and a birthday inside the last 18 years', () => {
    const base = { name: 'Noah', sex: 'male' as const, birthday: { year: 2016, month: 3, day: 4 } };
    expect(canAddFamilyMember(base, now)).toBe(true);
    expect(canAddFamilyMember({ ...base, name: ' ' }, now)).toBe(false);
    expect(canAddFamilyMember({ ...base, sex: null }, now)).toBe(false);
    expect(canAddFamilyMember({ ...base, birthday: null }, now)).toBe(false);
    // Future and 18+ are refused; October 2008 days 1 and 2 are already 18 (frame 112).
    expect(canAddFamilyMember({ ...base, birthday: { year: 2026, month: 10, day: 3 } }, now)).toBe(false);
    expect(canAddFamilyMember({ ...base, birthday: { year: 2008, month: 10, day: 2 } }, now)).toBe(false);
    expect(canAddFamilyMember({ ...base, birthday: { year: 2008, month: 10, day: 3 } }, now)).toBe(true);
    expect(familyBirthDayLimits(now).min).toEqual({ year: 2008, month: 10, day: 3 });
  });

  it('detects edits and the adult server error', () => {
    const [member] = normalizeFamilyMembers({ members: [{ id: 1, name: 'Noah', relationship: 'child', sex: 'male', birth_month: 3, birth_year: 2016, birth_day: 4 }] } as never);
    const same = { name: 'Noah', sex: 'male' as const, birthday: { year: 2016, month: 3, day: 4 } };
    expect(familyEditChanged(member, same)).toBe(false);
    expect(familyEditChanged(member, { ...same, name: 'Noah J' })).toBe(true);
    expect(familyEditChanged(member, { ...same, birthday: { year: 2016, month: 3, day: 5 } })).toBe(true);
    expect(isAdultBirthdayError({ response: { status: 400, data: { date_of_birth: FAMILY_COPY.adultError } } })).toBe(true);
    expect(isAdultBirthdayError({ response: { status: 500, data: {} } })).toBe(false);
    expect(isAdultBirthdayError(new Error('x'))).toBe(false);
  });

  it('remove copy follows frame 102 and keeps pronouns matched to the stored sex', () => {
    expect(FAMILY_COPY.removeTitle('Noah')).toBe('Remove Noah?');
    expect(FAMILY_COPY.removeBody('male')).toBe("He'll be taken off your family list and off any gatherings you've RSVP'd to for him.");
    expect(FAMILY_COPY.removeBody('female')).toContain("She'll");
    expect(FAMILY_COPY.removeBody(null)).toBe("They'll be taken off your family list and off any gatherings you've RSVP'd to for them.");
  });

  it('Backend shape: month-only rows have null date_of_birth + precision month, full rows precision day', () => {
    const [month, day, spouse] = normalizeFamilyMembers({
      members: [
        { id: 1, name: 'Noah', relationship: 'child', sex: 'male', birth_month: 3, birth_year: 2016, birth_day: null, birth_precision: 'month', age: 10 },
        { id: 2, name: 'Caleb', relationship: 'child', sex: 'male', birth_month: 6, birth_year: 2011, birth_day: 9, birth_precision: 'day', date_of_birth: '2011-06-09', age: 15 },
        { id: 3, name: 'Rachel', relationship: 'spouse', sex: 'female', birth_month: null, birth_year: null, birth_day: null, birth_precision: null, age: null },
      ],
    } as never);
    expect(month).toMatchObject({ date_of_birth: null, birth_day: null, birth_month: 3, birth_year: 2016 });
    expect(isMonthYearOnly(month)).toBe(true);
    expect(memberBirthLine(month)).toBe('Born March 2016');
    expect(memberBirthLine(day)).toBe('Born June 9, 2011');
    expect(memberBirthLine(spouse)).toBe('Adult');
  });

  it('a last-day-of-month date_of_birth with precision day is a real day (no last-day heuristic)', () => {
    const [row] = normalizeFamilyMembers({
      members: [{ id: 1, name: 'A', relationship: 'child', birth_month: 3, birth_year: 2016, birth_day: 31, birth_precision: 'day', date_of_birth: '2016-03-31' }],
    } as never);
    expect(memberBirthLine(row)).toBe('Born March 31, 2016');
    expect(isMonthYearOnly(row)).toBe(false);
  });

  it('never throws on null or missing date_of_birth, birth fields, or an empty response', () => {
    expect(() => normalizeFamilyMembers({ members: [{ id: 1, name: 'X', relationship: 'child', date_of_birth: null }] } as never)).not.toThrow();
    expect(normalizeFamilyMembers({ members: [{ id: 1, name: 'X', relationship: 'child', date_of_birth: null }] } as never)[0]).toMatchObject({ birth_month: null, date_of_birth: null });
    expect(memberBirthLine(normalizeFamilyMembers({ members: [{ id: 1, name: 'X', relationship: 'child', date_of_birth: null }] } as never)[0])).toBe('Adult');
    expect(normalizeFamilyMembers(null)).toEqual([]);
  });
});

describe('adult / spouse payloads', () => {
  const spousePayload = {
    members: [
      // Exactly what the server sends for a spouse: no date_of_birth key at all, sex may be an empty string.
      { id: 1, name: 'Rachel', relationship: 'spouse', sex: '', birth_month: null, birth_year: null, birth_day: null, age: null },
      { id: 2, name: 'Noah', relationship: 'child', sex: 'male', birth_month: 3, birth_year: 2016, birth_day: null, birth_precision: 'month', age: 10 },
    ],
  };

  it('normalizeFamilyMembers keeps a spouse as an Adult with null birth fields and never throws', () => {
    expect(() => normalizeFamilyMembers(spousePayload as never)).not.toThrow();
    const [spouse, child] = normalizeFamilyMembers(spousePayload as never);
    expect(spouse).toEqual({
      id: 1,
      name: 'Rachel',
      relationship: 'spouse',
      sex: null,
      birth_month: null,
      birth_year: null,
      birth_day: null,
      date_of_birth: null,
      age: null,
    });
    expect(memberBirthLine(spouse)).toBe('Adult');
    expect(memberBirthLine(spouse)).not.toMatch(/null|undefined/);
    expect(isAdultMember(spouse)).toBe(true);
    expect(isAdultMember(child)).toBe(false);
    expect(memberBirthLine(child)).toBe('Born March 2016');
  });

  it('a spouse whose payload has birth data reads Born <date> like a child (day known, month-only), never Adult', () => {
    const [full, monthOnly, dayPrecision] = normalizeFamilyMembers({
      members: [
        { id: 1, name: 'Rachel', relationship: 'spouse', birth_month: 5, birth_year: 1985, birth_day: 3, birth_precision: 'day', age: 41 },
        { id: 2, name: 'Dan', relationship: 'spouse', birth_month: 3, birth_year: 1984, birth_day: null, birth_precision: 'month', age: 42 },
        { id: 3, name: 'Lee', relationship: 'spouse', date_of_birth: '1980-11-30', age: 45 },
      ],
    } as never);
    expect(full).toMatchObject({ birth_month: 5, birth_year: 1985, birth_day: 3, date_of_birth: '1985-05-03' });
    expect(memberBirthLine(full)).toBe('Born May 3, 1985');
    expect(memberBirthLine(monthOnly)).toBe('Born March 1984');
    expect(monthOnly.date_of_birth).toBeNull();
    expect(memberBirthLine(dayPrecision)).toBe('Born November 30, 1980');
    // Adults are still edited as adults (no birthday editing), and "Add day" is for children only.
    expect(isAdultMember(full)).toBe(true);
    expect(isMonthYearOnly(monthOnly)).toBe(false);
    for (const member of [full, monthOnly, dayPrecision]) {
      expect(memberBirthLine(member)).not.toMatch(/null|undefined/);
    }
  });

  it('only when every birth field is null does an adult read Adult', () => {
    const [none, partial] = normalizeFamilyMembers({
      members: [
        { id: 1, name: 'Rachel', relationship: 'spouse', birth_month: null, birth_year: null, birth_day: null, birth_precision: null, age: null },
        { id: 2, name: 'Dan', relationship: 'spouse', birth_month: 3, birth_year: null, birth_day: null },
      ],
    } as never);
    expect(memberBirthLine(none)).toBe('Adult');
    expect(memberBirthLine(partial)).toBe('Adult');
  });

  it('empty or missing members and nameless rows do not throw', () => {
    expect(normalizeFamilyMembers(null)).toEqual([]);
    expect(normalizeFamilyMembers({} as never)).toEqual([]);
    expect(memberInitials(undefined)).toBe('');
    expect(memberInitials('Rachel B')).toBe('RA');
    const [row] = normalizeFamilyMembers({ members: [{ id: 9, relationship: 'spouse' }] } as never);
    expect(memberBirthLine(row)).toBe('Adult');
  });

  it('a row with no birth data at all is treated as an adult whatever its relationship says', () => {
    const [row] = normalizeFamilyMembers({ members: [{ id: 3, name: 'Pat', birth_month: null, birth_year: null }] } as never);
    expect(isAdultMember(row)).toBe(true);
  });
});
