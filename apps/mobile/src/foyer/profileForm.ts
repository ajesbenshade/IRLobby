import { PROFILE_COPY, VISIBILITY_OPTIONS, type VisibilityLevel } from '@constants/foyerCopy';

export const PHONE_DIGITS = 10;

export const phoneDigits = (value: string) => value.replace(/\D/g, '');

/** Accepts a 10-digit US number, or 11 digits starting with 1, or an existing +1 E.164 value. */
export const isValidUsPhone = (value: string): boolean => {
  const digits = phoneDigits(value);
  return digits.length === PHONE_DIGITS || (digits.length === 11 && digits.startsWith('1'));
};

/** Empty is allowed; otherwise it must be a valid 10-digit number. */
export const phoneError = (value: string): string | null =>
  !value.trim() || isValidUsPhone(value) ? null : PROFILE_COPY.phoneHint;

export const toE164 = (value: string): string => {
  const digits = phoneDigits(value);
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return value.trim();
};

/** Show a stored E164 number as the user typed it: (215) 555-0123. */
export const formatPhoneForField = (value: string | null | undefined): string => {
  const digits = phoneDigits(value ?? '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length !== 10) {
    return value ?? '';
  }
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
};

export type ProfileDraft = {
  name: string;
  city: string;
  dateOfBirth: string | null;
  sex: 'male' | 'female' | '';
  churchId: number | null;
  visibility: VisibilityLevel;
  phone: string;
  showEmail: boolean;
  showPhone: boolean;
  dmFromSharedEvents: boolean;
};

/** The phone toggle stays off (and disabled) until a valid phone is entered. */
export const phoneToggleEnabled = (phone: string) => isValidUsPhone(phone);

export const normalizeDraft = (draft: ProfileDraft): ProfileDraft => ({
  ...draft,
  showPhone: phoneToggleEnabled(draft.phone) ? draft.showPhone : false,
});

export const buildProfilePatch = (draft: ProfileDraft, options: { isMinor: boolean }) => {
  const [firstName, ...rest] = draft.name.trim().split(/\s+/);
  const normalized = normalizeDraft(draft);
  return {
    first_name: firstName ?? '',
    last_name: rest.join(' '),
    location: draft.city.trim(),
    city: draft.city.trim(),
    ...(draft.dateOfBirth ? { date_of_birth: draft.dateOfBirth } : {}),
    sex: draft.sex || null,
    church_id: draft.churchId,
    profile_visibility: draft.visibility,
    phone: draft.phone.trim() ? toE164(draft.phone) : '',
    show_email: draft.showEmail,
    show_phone: normalized.showPhone,
    // Under-18 accounts have no toggle; the server forces it off.
    ...(options.isMinor ? {} : { dm_from_shared_events: draft.dmFromSharedEvents }),
  };
};

export const isDraftDirty = (a: ProfileDraft, b: ProfileDraft) => JSON.stringify(normalizeDraft(a)) !== JSON.stringify(normalizeDraft(b));

export const visibilityLabel = (value: VisibilityLevel) => VISIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;

/** Age in whole years from an ISO date. Null if the date is missing or invalid. */
export const ageFromIso = (iso: string | null | undefined, now = new Date()): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) {
    age -= 1;
  }
  return age;
};
