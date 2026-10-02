import { FAMILY_COPY } from '@constants/foyerCopy';

import { familyBirthDayLimits } from '../dates';
import {
  ageBandForAge,
  canAddFamilyMember,
  familyEditChanged,
  isAdultBirthdayError,
  isMonthYearOnly,
  memberBirthLine,
  normalizeFamilyMembers,
} from '../family';

const now = new Date(2026, 9, 2); // Fri Oct 2, 2026

describe('family members', () => {
  it('reads full dates, legacy month/year rows and legacy spouse rows from the members list', () => {
    const members = normalizeFamilyMembers({
      children: [
        { id: 2, name: 'Caleb', date_of_birth: '2011-06-09', age: 15 },
        { id: 3, name: 'Noah', date_of_birth: '2016-03-31', age: 10 },
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
        { id: 2, name: 'B', relationship: 'child', birth_month: 3, birth_year: 2016, birth_day: null, date_of_birth: '2016-03-31' },
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
});
