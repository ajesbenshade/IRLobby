import { ATTENDEE_COPY } from '@constants/foyerCopy';

import type { HostAttendeePerson, HostAttendeesResponse } from '@services/foyerService';

export const ageBandLabel = (band: string | null | undefined): string => {
  const normalized = (band ?? '').toLowerCase().replace('–', '-');
  if (normalized === 'under 13' || normalized === 'under13') {
    return ATTENDEE_COPY.ageBand.under13;
  }
  if (normalized === '13-17') {
    return ATTENDEE_COPY.ageBand.teen;
  }
  return ATTENDEE_COPY.ageBand.adult;
};

/** Names and age bands only. Strips anything else a server might add (emails, ids, locations, birth dates). */
export const sanitizeHostPerson = (person: HostAttendeePerson): HostAttendeePerson => ({
  name: String(person.name ?? ''),
  relationship: person.relationship,
  age_band: person.age_band ?? null,
});

export type HouseholdGroup = { name: string; people: HostAttendeePerson[] };

export const sanitizeHouseholds = (data: HostAttendeesResponse | null): HouseholdGroup[] =>
  (data?.households ?? []).map((household) => ({
    name: String(household.name ?? ''),
    people: (household.people ?? []).map(sanitizeHostPerson),
  }));

/** First N people across households, then the rest behind `Show N more going`. */
export const splitVisiblePeople = (
  groups: HouseholdGroup[],
  limit: number,
  expanded: boolean,
): { groups: HouseholdGroup[]; hidden: number } => {
  const total = groups.reduce((sum, group) => sum + group.people.length, 0);
  if (expanded || total <= limit) {
    return { groups, hidden: 0 };
  }
  let remaining = limit;
  const visible: HouseholdGroup[] = [];
  for (const group of groups) {
    if (remaining <= 0) {
      break;
    }
    const people = group.people.slice(0, remaining);
    remaining -= people.length;
    visible.push({ name: group.name, people });
  }
  return { groups: visible, hidden: total - limit };
};

export const isHostAttendeeView = (data: HostAttendeesResponse | null): boolean => Array.isArray(data?.households);

export type PastAttendee = { userId: number | null; name: string; isMinor: boolean; openable: boolean };

/** Past-event list: under-18 (user_id null) show as `Family member` with no link. */
export const buildPastAttendees = (data: HostAttendeesResponse | null): PastAttendee[] =>
  (data?.attendees ?? []).map((attendee) => {
    const isMinor = attendee.user_id == null;
    return {
      userId: attendee.user_id,
      name: isMinor ? ATTENDEE_COPY.familyMember : String(attendee.name ?? ''),
      isMinor,
      openable: !isMinor,
    };
  });
