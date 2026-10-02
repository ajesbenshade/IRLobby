import { FEATURES } from '@constants/features';

/**
 * Birthday sharing is OFF until Aaron answers the privacy questions (per-child "Show on my profile", adult opt-in,
 * wishes versus push, and whether adults can be added). Even when forced on with EXPO_PUBLIC_FOYER_BIRTHDAYS=on, each
 * piece also needs its backend field or endpoint to exist, so nothing half-works.
 *
 * Hard rules that hold with the flag on or off:
 *  - a birthday is never shown to a host or a guest, and a child's birthday is never returned to anyone but their parent;
 *  - accounts under 18 never show a birthday (the switch is off and disabled);
 *  - the year of an adult's birthday is never shown.
 */
export const birthdaysEnabled = (): boolean => FEATURES.birthdays === 'on';

type Rec = Record<string, unknown> | null | undefined;

const has = (value: Rec, key: string) => Boolean(value) && typeof value === 'object' && key in (value as object);

/** Own `Show my birthday` row: flag on AND the profile payload carries `show_birthday`. */
export const ownBirthdaySwitchSupported = (profile: Rec): boolean => birthdaysEnabled() && has(profile, 'show_birthday');

/** Per-child `Show on my profile`: flag on AND the household payload carries `show_birthday` for that member. */
export const childShareSupported = (member: Rec): boolean => birthdaysEnabled() && has(member, 'show_birthday');

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
