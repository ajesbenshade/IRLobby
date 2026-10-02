import { GOING_COPY } from '@constants/foyerCopy';

export type AudienceGender = 'everyone' | 'men' | 'women';
export type HostKind = 'person' | 'church';

export const CHAT_GATE_MESSAGE = 'Chat opens for people who are going.';
export const UNDER_13_MESSAGE = 'Accounts are not available under age 13.';
export const CAPACITY_ERROR = 'Capacity must be a whole number from 1 to 500.';
export const CALENDAR_ADDRESS_WARNING =
  "Public events show their location on franconiamennonite.org. Don't list a home address unless you want the congregation to see it.";
export const ADDRESS_AFTER_RSVP = 'Address shared after you RSVP';
export const RSVP_CHOOSE_PEOPLE_MESSAGE = 'Choose yourself or your family.';
/** @deprecated Final copy lives in constants/foyerCopy (GOING_COPY.underThirteenNote). */
export const WHOS_COMING_NOTE =
  "Family members under 13 are RSVP names only — they don't have accounts.";

export type GatheringLike = {
  audience?: string | null;
  audience_gender?: AudienceGender | string | null;
  age_min?: number | null;
  age_max?: number | null;
  going_count?: number | null;
  participant_count?: number | null;
  cover_photo_url?: string | null;
  images?: string[] | null;
  host_name?: string | null;
  host?:
    | string
    | {
        firstName?: string;
        lastName?: string;
        email?: string;
        avatarUrl?: string | null;
        avatar_url?: string | null;
      }
    | null;
  host_kind?: HostKind | string | null;
  my_rsvp?: { status?: string; people_count?: number; include_self?: boolean } | null;
};

export const audienceChipLabel = (activity: GatheringLike): string => {
  const provided = activity.audience?.trim();
  if (provided) {
    return provided;
  }

  const gender = activity.audience_gender ?? 'everyone';
  const who = gender === 'men' ? 'Men' : gender === 'women' ? 'Women' : 'Everyone';
  const min = activity.age_min ?? null;
  const max = activity.age_max ?? null;
  if (min != null && max == null && min >= 18) {
    return `${who} · 18+`;
  }
  if (min != null && max == null) {
    return `${who} · Ages ${min}+`;
  }
  if (min != null && max != null) {
    return `${who} · Ages ${min}–${max}`;
  }
  return who;
};

export const goingCountLabel = (count: number) => `${count} going`;

export const coverPhotoUrl = (activity: GatheringLike): string | null => {
  const cover = activity.cover_photo_url?.trim();
  if (cover) {
    return cover;
  }
  const first = activity.images?.find((item) => typeof item === 'string' && item.trim().length > 0);
  return first ?? null;
};

export const hostDisplayName = (activity: GatheringLike): string => {
  const named = activity.host_name?.trim();
  if (named) {
    return named;
  }
  if (typeof activity.host === 'string' && activity.host.trim()) {
    return activity.host.trim();
  }
  if (activity.host && typeof activity.host === 'object') {
    const name = [activity.host.firstName, activity.host.lastName].filter(Boolean).join(' ').trim();
    return name || activity.host.email || 'Host';
  }
  return 'Host';
};

export const hostAvatarUrl = (activity: GatheringLike): string | null => {
  if (activity.host && typeof activity.host === 'object') {
    return activity.host.avatarUrl ?? activity.host.avatar_url ?? null;
  }
  return null;
};

export type WhosComingDependent = {
  id: number;
  name: string;
  age?: number | null;
  eligible: boolean;
  reason?: string | null;
  relationship?: string | null;
  sex?: string | null;
  birth_month?: number | null;
  birth_year?: number | null;
  birth_day?: number | null;
  date_of_birth?: string | null;
};

export type WhosComingResponse = {
  me: { name: string; eligible: boolean; reason?: string | null; age?: number | null; sex?: string | null };
  dependents: WhosComingDependent[];
  /** Newer servers return the same people (spouse included) under `members`. */
  members?: WhosComingDependent[];
  note?: string | null;
};

/** The family list for the RSVP screens: `members` when the server sends it, else `dependents`. */
export const whosComingPeople = (response: Pick<WhosComingResponse, 'dependents' | 'members'>): WhosComingDependent[] =>
  response.members && response.members.length >= response.dependents.length ? response.members : response.dependents;

export const shouldSkipWhosComingSheet = (response: Pick<WhosComingResponse, 'dependents' | 'members'>) =>
  whosComingPeople(response).length === 0;

export const buildRsvpPayload = (includeSelf: boolean, dependentIds: number[]) => ({
  include_self: includeSelf,
  dependent_ids: dependentIds,
  member_ids: dependentIds,
});

export const peopleCount = (includeSelf: boolean, dependentIds: number[]) =>
  (includeSelf ? 1 : 0) + dependentIds.length;

export const confirmGoingLabel = (count: number) => `Confirm · ${count} going`;

export const defaultRsvpSelection = (response: WhosComingResponse) => ({
  includeSelf: response.me.eligible,
  dependentIds: whosComingPeople(response)
    .filter((child) => child.eligible)
    .map((child) => child.id),
});

export type CapacityParse =
  | { ok: true; capacity: number | null }
  | { ok: false; message: string };

export const parseCapacity = (raw: string): CapacityParse => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, capacity: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: CAPACITY_ERROR };
  }
  const value = Number(trimmed);
  if (value < 1 || value > 500) {
    return { ok: false, message: CAPACITY_ERROR };
  }
  return { ok: true, capacity: value };
};

export const isChatGateError = (status: number | undefined, message: string | undefined) =>
  status === 403 || /not authorized/i.test(message ?? '');

export const registrationFieldError = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const dob = (data as { date_of_birth?: unknown }).date_of_birth;
  if (Array.isArray(dob) && typeof dob[0] === 'string') {
    return dob[0];
  }
  return null;
};

export const formatBornLine = (isoDate: string, age: number) => {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return `Born ${isoDate} · age ${age}`;
  }
  const formatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `Born ${formatted} · age ${age}`;
};

export const householdCountLabel = (count: number) =>
  count === 1 ? '1 child' : `${count} children`;

export const whosGoingSummary = (peopleCount: number | null | undefined) => {
  const count = peopleCount ?? 1;
  if (count <= 1) {
    return 'You';
  }
  const children = count - 1;
  return children === 1 ? 'You + 1 child' : `You + ${children} children`;
};

export const isUpcomingGathering = (time: string | null | undefined, now = new Date()) => {
  if (!time) {
    return true;
  }
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) {
    return true;
  }
  return date.getTime() >= now.getTime();
};

export const childDisplayName = (name: string, age?: number | null) =>
  age == null ? name : `${name} (age ${age})`;

/**
 * Address line for a gathering. Member-hosted events hide the exact address
 * until the viewer RSVPs, so a blank location must never render as an empty row.
 */
export const gatheringLocationLabel = (location: string | null | undefined): string => {
  const trimmed = location?.trim();
  return trimmed ? trimmed : ADDRESS_AFTER_RSVP;
};

/** Older servers answer an empty RSVP with "Choose yourself or a child."; show the family wording. */
export const friendlyRsvpMessage = (message: string): string => {
  if (/choose yourself or a child/i.test(message)) {
    return RSVP_CHOOSE_PEOPLE_MESSAGE;
  }
  // Server 400 when someone chosen is outside the age range ("Some people are not eligible for this gathering.").
  if (/not eligible for this gathering|outside this event'?s age range/i.test(message)) {
    return GOING_COPY.ageRangeRejected;
  }
  return message;
};

/**
 * True when nobody in the RSVP list can be selected, so posting would send an
 * empty RSVP (the server answers 400). The caller should explain instead.
 */
export const hasNoEligiblePeople = (response: WhosComingResponse): boolean =>
  !response.me.eligible && !whosComingPeople(response).some((child) => child.eligible);
