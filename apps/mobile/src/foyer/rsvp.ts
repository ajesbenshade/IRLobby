import { FAMILY_COPY, GOING_COPY } from '@constants/foyerCopy';

import { MONTH_NAMES, daysInMonth, formatBirthdayLong, parseIsoDate } from './dates';
import { whosComingPeople, type WhosComingDependent, type WhosComingResponse } from './logic';

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
export const notEligibleReason = (
  reason: string | null | undefined,
  range: { age_min?: number | null; age_max?: number | null } | null,
): string => {
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
 * Under each person on the RSVP screens: `Adult` for a legacy spouse row, else `Born March 4, 2016 · age 10`
 * (or `Born March 2016 · age 10` for a legacy month/year row). Only the account owner sees this; hosts never do.
 */
export const personSubtitle = (member: WhosComingDependent): string => {
  const isChild = (member.relationship ?? 'child') === 'child';
  const dob = parseIsoDate(member.date_of_birth ?? null);
  const month = member.birth_month ?? dob?.month ?? null;
  const year = member.birth_year ?? dob?.year ?? null;
  if (!isChild || month == null || year == null) {
    return FAMILY_COPY.adult;
  }
  // A saved day wins; a bare date that is the last day of its month is how the server stores month/year-only rows.
  const dayKnown =
    member.birth_day != null || (member.birth_day === undefined && dob != null && dob.day !== daysInMonth(dob.year, dob.month));
  const day = member.birth_day ?? dob?.day ?? null;
  const born = dayKnown && day != null ? formatBirthdayLong({ year, month, day }) : `${MONTH_NAMES[month - 1]} ${year}`;
  const line = FAMILY_COPY.born(born);
  return member.age != null ? `${line} · age ${member.age}` : line;
};

/** Me plus every family member, in the order the screens draw them. Ineligible people are kept, never hidden. */
export const buildRsvpPeople = (
  response: WhosComingResponse,
  range: { age_min?: number | null; age_max?: number | null } | null = null,
): RsvpPerson[] => {
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
