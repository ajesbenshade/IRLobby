/** Account holders are voting members 18 and older. Household children stay under 18. */

export const MIN_ACCOUNT_AGE = 18;

export const ACCOUNT_AGE_ERROR = 'Accounts are for voting members 18 and older.';

export const VOTING_MEMBER_CHECKBOX = 'I am a voting member of Franconia Mennonite Church.';

export const BIRTH_DATE_HELPER =
  'The Foyer is for Franconia voting members. Children under 18 are added under a parent’s My family.';

export const BIRTH_DATE_REQUIRED = 'Choose your birth date to continue.';

export const HOUSEHOLD_CHILD_ERROR = 'Only children under 18 can be added to a household.';

export const CHILDREN_RSVP_NOTE =
  "Children under 18 are RSVP names only — they don't have accounts.";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseIsoDate = (iso: string): { year: number; month: number; day: number } | null => {
  const match = ISO_DATE.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return { year, month, day };
};

/** Whole years on `now`. Turning a birthday today counts as that age. Null when the date is not real. */
export const ageOn = (iso: string, now = new Date()): number | null => {
  const born = parseIsoDate(iso);
  if (!born) return null;
  let age = now.getFullYear() - born.year;
  if (
    now.getMonth() + 1 < born.month ||
    (now.getMonth() + 1 === born.month && now.getDate() < born.day)
  ) {
    age -= 1;
  }
  return age;
};

/** Empty, invalid, future, or under 18. Exactly 18 today is allowed. */
export const accountBirthDateError = (iso: string, now = new Date()): string | null => {
  const trimmed = iso.trim();
  if (!trimmed) return BIRTH_DATE_REQUIRED;
  const born = parseIsoDate(trimmed);
  if (!born) return ACCOUNT_AGE_ERROR;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const birth = new Date(born.year, born.month - 1, born.day);
  if (birth.getTime() > today.getTime()) return ACCOUNT_AGE_ERROR;
  const age = ageOn(trimmed, now);
  if (age == null || age < MIN_ACCOUNT_AGE) return ACCOUNT_AGE_ERROR;
  return null;
};

/**
 * Household add: 18 and older is refused. A date that does not parse is left for the server.
 * Turning 18 today is already an adult.
 */
/** Google/Apple 400 for a new account that did not send the birth date and the checkbox. */
export const isVotingGateBody = (body: unknown): boolean => {
  if (!body || typeof body !== 'object') return false;
  return 'date_of_birth' in body || 'voting_member_attested' in body;
};

export const isVotingGateError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object' || !('body' in error)) return false;
  return isVotingGateBody((error as { body?: unknown }).body);
};

export const householdChildBirthDateError = (iso: string, now = new Date()): string | null => {
  const age = ageOn(iso.trim(), now);
  if (age == null) return null;
  if (age >= MIN_ACCOUNT_AGE) return HOUSEHOLD_CHILD_ERROR;
  return null;
};
