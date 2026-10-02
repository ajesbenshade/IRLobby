import { FAMILY_COPY } from '@constants/foyerCopy';

import type { FamilyMember, FamilyRelationship, FamilySex, HouseholdResponse } from '../services/foyerService';
import {
  MONTH_NAMES,
  compareDays,
  familyBirthDayLimits,
  formatBirthdayLong,
  isDayAllowed,
  parseIsoDate,
  type DayValue,
} from './dates';

const RELATIONSHIPS: FamilyRelationship[] = ['spouse', 'child'];

const asRelationship = (value: unknown): FamilyRelationship =>
  RELATIONSHIPS.includes(value as FamilyRelationship) ? (value as FamilyRelationship) : 'child';

type ChildRow = NonNullable<HouseholdResponse['children']>[number];

/**
 * Does this row carry the day of the month? Backend (PR #42) sends `birth_month`, `birth_year`, `birth_day` and
 * `birth_precision` (`day` or `month`); `date_of_birth` is null for month-only children and is never a made-up last day of
 * the month. A null `date_of_birth` must never throw, so every date read goes through `parseIsoDate(null) -> null`.
 */
const resolveBirth = (
  member: { birth_month?: number | null; birth_year?: number | null; birth_day?: number | null; day?: number | null; date_of_birth?: string | null; birth_precision?: string | null },
  child: ChildRow | undefined,
): { month: number | null; year: number | null; day: number | null } => {
  const dob = parseIsoDate(member.date_of_birth ?? child?.date_of_birth ?? null);
  const month = member.birth_month ?? child?.birth_month ?? dob?.month ?? null;
  const year = member.birth_year ?? child?.birth_year ?? dob?.year ?? null;
  const precision = member.birth_precision ?? child?.birth_precision ?? null;
  if (precision === 'month') {
    return { month, year, day: null };
  }
  const explicit = member.birth_day ?? member.day ?? child?.birth_day;
  if (typeof explicit === 'number') {
    return { month, year, day: explicit };
  }
  if (dob) {
    return { month: dob.month, year: dob.year, day: dob.day };
  }
  return { month, year, day: null };
};

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Build the My family list from either the documented `members` shape or the older `children`-only response.
 * Full dates are kept in memory only for this owner's own screens; hosts never receive them.
 */
export const normalizeFamilyMembers = (data: HouseholdResponse | null | undefined): FamilyMember[] => {
  const children = new Map((data?.children ?? []).map((child) => [child.id, child]));
  const build = (
    member: NonNullable<HouseholdResponse['members']>[number] | (ChildRow & { relationship?: string }),
    relationship: FamilyRelationship,
  ): FamilyMember => {
    const birth = relationship === 'child' ? resolveBirth(member as never, children.get(member.id)) : { month: null, year: null, day: null };
    const hasDay = birth.day != null && birth.month != null && birth.year != null;
    return {
      id: member.id,
      name: member.name,
      relationship,
      sex: (member as { sex?: string | null }).sex || null,
      birth_month: birth.month,
      birth_year: birth.year,
      birth_day: hasDay ? birth.day : null,
      date_of_birth: hasDay ? `${birth.year}-${pad(birth.month as number)}-${pad(birth.day as number)}` : null,
      age: (member as { age?: number | null }).age ?? null,
    };
  };
  if (Array.isArray(data?.members)) {
    return data.members.map((member) => build(member, asRelationship(member.relationship)));
  }
  return (data?.children ?? []).map((child) => build(child, 'child'));
};

/** The saved full birth date, or null when only a month and year (or nothing, for an adult) is stored. */
export const memberBirthDay = (member: FamilyMember): DayValue | null => parseIsoDate(member.date_of_birth ?? null);

/** A child saved before full birth dates: month and year, no day. */
export const isMonthYearOnly = (member: FamilyMember): boolean =>
  member.relationship === 'child' && memberBirthDay(member) == null && member.birth_month != null && member.birth_year != null;

/** `Born March 4, 2016`, `Born March 2016` (legacy), or `Adult` (legacy spouse row / no birth data). */
export const memberBirthLine = (member: FamilyMember): string => {
  const day = memberBirthDay(member);
  if (day) {
    return FAMILY_COPY.born(formatBirthdayLong(day));
  }
  if (isMonthYearOnly(member)) {
    return FAMILY_COPY.born(`${MONTH_NAMES[(member.birth_month as number) - 1]} ${member.birth_year}`);
  }
  return FAMILY_COPY.adult;
};

/** `13–17`, `Under 13`, or null for adults. Age is computed by the server. */
export const ageBandForAge = (age: number | null | undefined): string | null => {
  if (age == null) {
    return null;
  }
  if (age < 13) {
    return 'Under 13';
  }
  if (age < 18) {
    return '13–17';
  }
  return null;
};

export const memberInitials = (name: string) => name.replace(/\s+/g, '').slice(0, 2).toUpperCase();

/** Add needs a name, a sex and a birthday that is inside the last 18 years. No relationship. */
export const canAddFamilyMember = (input: {
  name: string;
  sex: FamilySex | null;
  birthday: DayValue | null;
}, now = new Date()): boolean =>
  Boolean(input.name.trim()) && input.sex != null && input.birthday != null && isDayAllowed(input.birthday, familyBirthDayLimits(now));

/** Has anything changed since the member was loaded? Save stays grey until it has. */
export const familyEditChanged = (
  member: FamilyMember,
  edit: { name: string; sex: FamilySex | null; birthday: DayValue | null },
): boolean => {
  const original = memberBirthDay(member);
  const birthChanged = (original == null) !== (edit.birthday == null) || (original != null && edit.birthday != null && compareDays(original, edit.birthday) !== 0);
  return edit.name.trim() !== member.name || (member.sex ?? null) !== edit.sex || birthChanged;
};

/** Add family member 400 for an adult: field-level, under the Birthday row. */
export const isAdultBirthdayError = (error: unknown): boolean => {
  const data = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  if (!data || data.status !== 400 || typeof data.data !== 'object' || data.data == null) {
    return false;
  }
  const body = data.data as Record<string, unknown>;
  const text = JSON.stringify(body.date_of_birth ?? '');
  return Boolean(body.date_of_birth) && /under 18|18/.test(text);
};

export const sexOf = (value: unknown): FamilySex | null => (value === 'male' || value === 'female' ? value : null);
