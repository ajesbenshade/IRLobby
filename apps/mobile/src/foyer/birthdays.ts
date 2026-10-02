import { FEATURES } from '@constants/features';

/**
 * Birthday policy (Aaron's decision, Oct 2):
 *  - ONLY the primary account holder can share their OWN birthday: an adult opt-in `Show my birthday`, default off,
 *    month and day only (never the year), never for anyone under 18.
 *  - Family members' (household) birthdays are NEVER shown or shareable to anyone. There is no per-child switch, flag or
 *    string. They exist only to check a gathering's age range, and only the parent sees them (My family, RSVP list).
 *  - Hosts and guests see a family member's name and age band only.
 *
 * The own-birthday UI and the friends card stay OFF (EXPO_PUBLIC_FOYER_BIRTHDAYS, default off) and also need their backend
 * field or endpoint to exist, so nothing half-works.
 */
export const birthdaysEnabled = (): boolean => FEATURES.birthdays === 'on';

type Rec = Record<string, unknown> | null | undefined;

const has = (value: Rec, key: string) => Boolean(value) && typeof value === 'object' && key in (value as object);

/** Own `Show my birthday` row: flag on AND the profile payload carries `show_birthday`. */
export const ownBirthdaySwitchSupported = (profile: Rec): boolean => birthdaysEnabled() && has(profile, 'show_birthday');

/** `Birthdays this week` card: flag on AND the friends endpoint answered (a 404 means not deployed). */
export const friendBirthdaysSupported = (status: number | null | undefined): boolean => birthdaysEnabled() && status === 200;

/** Accounts under 18 never show a birthday. Unknown age is treated as under 18 (fail closed). */
export const isUnder18 = (dateOfBirthIso: string | null | undefined, now = new Date()): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirthIso ?? '');
  if (!match) {
    return true;
  }
  const born = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const eighteen = new Date(born.getFullYear() + 18, born.getMonth(), born.getDate());
  return eighteen.getTime() > new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

/** `March 4` from an ISO date: month and day only, never the year. */
export const birthdayMonthDay = (dateOfBirthIso: string | null | undefined): string | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirthIso ?? '');
  if (!match) {
    return null;
  }
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[Number(match[2]) - 1]} ${Number(match[3])}`;
};
