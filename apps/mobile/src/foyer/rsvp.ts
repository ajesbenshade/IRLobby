import { FAMILY_COPY, GOING_COPY } from '@constants/foyerCopy';

import { MONTH_NAMES, daysInMonth, formatBirthdayLong, parseIsoDate, type DayValue } from './dates';
import { whosComingPeople, type WhosComingDependent, type WhosComingResponse } from './logic';

/** An event's age range plus the start time (the age is checked on the event's local day). A whole Activity fits. */
export type AgeRange = { age_min?: number | null; age_max?: number | null; time?: string | null };

export type RsvpPerson = {
  /** `me` or the family member id as a string. */
  key: string;
  id: number | null;
  name: string;
  initials: string;
  subtitle: string;
  eligible: boolean;
  /** Reason shown under a disabled person. */
  reason: string | null;
};

const initialsOf = (name: string) => name.replace(/\s+/g, '').slice(0, 2).toUpperCase();

/** `Not eligible: ages 13–17` when the server gave the generic age reason and we know the range. */
export const notEligibleReason = (reason: string | null | undefined, range: AgeRange | null): string => {
  const trimmed = reason?.trim() ?? '';
  const generic = !trimmed || /outside this event'?s age range/i.test(trimmed);
  if (generic && range && (range.age_min != null || range.age_max != null)) {
    const min = range.age_min ?? null;
    const max = range.age_max ?? null;
    if (min != null && max != null) {
      return GOING_COPY.notEligible(`ages ${min}–${max}`);
    }
    if (min != null) {
      return GOING_COPY.notEligible(`ages ${min}+`);
    }
    return GOING_COPY.notEligible(`ages up to ${max}`);
  }
  return trimmed || GOING_COPY.outsideRange;
};

/**
 * Under each person on the RSVP screens: `Born March 4, 2016 · age 10` (or `Born March 2016 · age 10` for month-only), for
 * children and adults alike whenever the payload has birth data. Only when every birth field is null it reads `Adult`.
 * Never prints `null`. Only the account owner sees this; hosts never do.
 */
export const personSubtitle = (member: WhosComingDependent): string => {
  const dob = parseIsoDate(member.date_of_birth ?? null);
  const month = member.birth_month ?? dob?.month ?? null;
  const year = member.birth_year ?? dob?.year ?? null;
  if (month == null || year == null || month < 1 || month > 12) {
    return FAMILY_COPY.adult;
  }
  // Backend: a real day is `birth_day` / a non-null `date_of_birth`; month-only rows have neither (no made-up last day).
  const dayKnown = member.birth_precision !== 'month' && (member.birth_day != null || dob != null);
  const day = member.birth_day ?? dob?.day ?? null;
  const born = dayKnown && day != null ? formatBirthdayLong({ year, month, day }) : `${MONTH_NAMES[month - 1]} ${year}`;
  const line = FAMILY_COPY.born(born);
  return member.age != null ? `${line} · age ${member.age}` : line;
};

const NY_DAY = (() => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return null;
  }
})();

/** The event's calendar day in America/New_York (the server checks ages on this day). Null when the time is unusable. */
export const eventLocalDay = (time: string | null | undefined): DayValue | null => {
  const date = time ? new Date(time) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  const text = NY_DAY ? NY_DAY.format(date) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return parseIsoDate(text);
};

const ageOnDay = (born: DayValue, on: DayValue): number => {
  let years = on.year - born.year;
  if (on.month < born.month || (on.month === born.month && on.day < born.day)) {
    years -= 1;
  }
  return years;
};

/**
 * Birth day used for the age check. A saved day is used as is. A legacy month/year-only row counts as the LAST day of that
 * month (Backend's rule, so a child never looks older than they are). A spouse row has no birth data.
 */
export const birthDayForAgeCheck = (member: WhosComingDependent): DayValue | null => {
  if ((member.relationship ?? 'child') !== 'child') {
    return null;
  }
  const dob = parseIsoDate(member.date_of_birth ?? null);
  const month = member.birth_month ?? dob?.month ?? null;
  const year = member.birth_year ?? dob?.year ?? null;
  if (month == null || year == null) {
    return null;
  }
  if (member.birth_day != null) {
    return { year, month, day: member.birth_day };
  }
  if (dob && dob.month === month && dob.year === year) {
    return dob;
  }
  return { year, month, day: daysInMonth(year, month) };
};

/**
 * Age on the event day. The server's `age` in the whos-coming list is the age ON THE EVENT DAY in New York time (Backend
 * confirmed). The app also works it out locally from the birthdate it has, and takes the LARGER of the two: the check never
 * blocks a child the server would let in, and it still catches a wrong `eligible` flag. Month-only rows have no day, so
 * they lean on the server's age.
 */
export const memberAgeOnEvent = (member: WhosComingDependent, range: AgeRange | null): number | null => {
  const eventDay = eventLocalDay(range?.time);
  const born = birthDayForAgeCheck(member);
  const local = eventDay && born ? ageOnDay(born, eventDay) : null;
  const server = typeof member.age === 'number' ? member.age : null;
  if (local == null && server == null) {
    return null;
  }
  return Math.max(local ?? Number.NEGATIVE_INFINITY, server ?? Number.NEGATIVE_INFINITY);
};

/** True when the gathering has an age range and the age is known and outside it. */
export const isOutsideAgeRange = (age: number | null, range: AgeRange | null): boolean => {
  if (age == null || !range) {
    return false;
  }
  return (range.age_min != null && age < range.age_min) || (range.age_max != null && age > range.age_max);
};

/**
 * Never trust only the server's `eligible` flag: a family member whose age on the event day is outside the gathering's age
 * range is marked ineligible here too (disabled row with the reason, never selected, never sent). Already-ineligible people
 * and people without birth data keep the server's answer.
 */
export const applyClientEligibility = (response: WhosComingResponse, range: AgeRange | null): WhosComingResponse => {
  if (!range || (range.age_min == null && range.age_max == null)) {
    return response;
  }
  const fix = (member: WhosComingDependent): WhosComingDependent =>
    member.eligible && isOutsideAgeRange(memberAgeOnEvent(member, range), range)
      ? { ...member, eligible: false, reason: notEligibleReason(null, range) }
      : member;
  const changed = (list: WhosComingDependent[] | undefined) => (list ?? []).map(fix);
  return {
    ...response,
    dependents: changed(response.dependents),
    ...(response.members ? { members: changed(response.members) } : {}),
  };
};

/** Ids that may be sent: only checked people who are eligible right now. */
export const eligibleMemberIds = (response: WhosComingResponse, range: AgeRange | null, ids: number[]): number[] => {
  const allowed = new Set(
    whosComingPeople(applyClientEligibility(response, range))
      .filter((member) => member.eligible)
      .map((member) => member.id),
  );
  return ids.filter((id) => allowed.has(id));
};

/** Me plus every family member, in the order the screens draw them. Ineligible people are kept, never hidden. */
export const buildRsvpPeople = (serverResponse: WhosComingResponse, range: AgeRange | null = null): RsvpPerson[] => {
  const response = applyClientEligibility(serverResponse, range);
  const me: RsvpPerson = {
    key: 'me',
    id: null,
    name: 'Me',
    initials: 'ME',
    subtitle: GOING_COPY.yourRsvp,
    eligible: response.me.eligible,
    reason: response.me.eligible ? null : notEligibleReason(response.me.reason, range),
  };
  const others = whosComingPeople(response).map((member): RsvpPerson => ({
    key: String(member.id),
    id: member.id,
    name: member.name,
    initials: initialsOf(member.name),
    subtitle: personSubtitle(member),
    eligible: member.eligible,
    reason: member.eligible ? null : notEligibleReason(member.reason, range),
  }));
  return [me, ...others];
};

export type RsvpSelection = { includeSelf: boolean; memberIds: number[] };

export const selectionFromMyRsvp = (
  myRsvp: { include_self?: boolean; dependent_ids?: number[]; member_ids?: number[] } | null | undefined,
): RsvpSelection => {
  const ids = Array.from(new Set([...(myRsvp?.dependent_ids ?? []), ...(myRsvp?.member_ids ?? [])]));
  return { includeSelf: myRsvp?.include_self !== false, memberIds: ids.sort((a, b) => a - b) };
};

export const selectionCount = (selection: RsvpSelection) => (selection.includeSelf ? 1 : 0) + selection.memberIds.length;

export const selectionsEqual = (a: RsvpSelection, b: RsvpSelection) =>
  a.includeSelf === b.includeSelf &&
  a.memberIds.length === b.memberIds.length &&
  [...a.memberIds].sort((x, y) => x - y).every((id, index) => id === [...b.memberIds].sort((x, y) => x - y)[index]);

/** `Save changes` appears only after the selection differs from what is saved. */
export const hasSelectionChanged = (saved: RsvpSelection, current: RsvpSelection) => !selectionsEqual(saved, current);

/** Nobody checked: Save is replaced by the Cancel RSVP flow. */
export const isEmptySelection = (selection: RsvpSelection) => selectionCount(selection) === 0;

/** RSVP statuses that never mean "going" (a pending or declined request still has people_count > 0). */
const NOT_GOING_STATUSES = new Set(['pending', 'declined', 'rejected', 'cancelled']);

export const isGoingRsvp = (
  myRsvp: { status?: string; people_count?: number } | null | undefined,
): boolean =>
  Boolean(
    myRsvp &&
      !NOT_GOING_STATUSES.has(String(myRsvp.status ?? '').toLowerCase()) &&
      (myRsvp.status === 'confirmed' || (myRsvp.people_count ?? 0) > 0),
  );

export const hasEventStarted = (time: string | null | undefined, now = new Date()): boolean => {
  if (!time) {
    return false;
  }
  const start = new Date(time);
  return !Number.isNaN(start.getTime()) && start.getTime() <= now.getTime();
};

/** Cancel RSVP: hidden for hosts and once the event has started. */
export const canCancelRsvp = (input: {
  isHost: boolean;
  isGoing: boolean;
  time: string | null | undefined;
  now?: Date;
}): boolean => input.isGoing && !input.isHost && !hasEventStarted(input.time, input.now);

/** Chat is only for people who are going, and the host. */
export const canSeeChat = (input: { isHost: boolean; isGoing: boolean; isChurchAdminOfChurchEvent?: boolean }): boolean =>
  input.isHost || input.isGoing || Boolean(input.isChurchAdminOfChurchEvent);

export const CANCEL_QUERY_KEYS: ReadonlyArray<ReadonlyArray<string>> = [
  ['mobile-discover-activities'],
  ['foyer-going'],
  ['foyer-hosted'],
  ['foyer-gathering'],
  ['mobile-hosted-activities'],
  ['mobile-conversations'],
  // Gathering chats: someone who cancelled must not keep seeing cached messages.
  ['foyer-gathering-chat'],
  ['foyer-requests'],
];
