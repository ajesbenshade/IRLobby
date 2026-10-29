/**
 * Profile save helpers for the web Profile form.
 * Kept free of imports so the node tests can load it directly.
 */

export const FRANCONIA_CHURCH_NAME = 'Franconia Mennonite Church';

export const PROFILE_SEX_HELPER = "Only used for men's or women's events";

export const MAILING_LABEL = 'Mailing address (optional)';

export const MAILING_HELPER =
  'Only people allowed by the visibility setting above can see this. Hidden by default.';

export const SHOW_ON_PROFILE = 'Show on my profile';

export const SHOW_CHILDREN_LABEL = 'Show my children in the Directory';

export const SHOW_CHILDREN_HELPER =
  "People in our church can see each child's first name and birthday (month and day) in the Directory so they can send birthday cards. Never the year.";

export const SHOW_CHILDREN_ONLY_ME =
  'Set Who can see my profile to People in my church to list your children.';

export const MAILING_INCOMPLETE = 'Enter a street, city, 2-letter state, and ZIP.';

export type ProfileSex = 'male' | 'female' | '';

export type ProfileVisibility = 'only_me' | 'friends' | 'church' | 'public';

export type MailingDraft = {
  street: string;
  street2: string;
  city: string;
  state: string;
  postal: string;
  show: boolean;
};

/** Empty until the member picks. Never invent male or female from a missing API value. */
export const profileSex = (value: unknown): ProfileSex =>
  value === 'male' || value === 'female' ? value : '';

export const profileVisibility = (value: unknown): ProfileVisibility =>
  value === 'friends' || value === 'church' || value === 'public' || value === 'only_me'
    ? value
    : 'only_me';

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
    ' ',
  ),
);

export const emptyMailing = (): MailingDraft => ({
  street: '',
  street2: '',
  city: '',
  state: '',
  postal: '',
  show: false,
});

export const isUsState = (value: string) => US_STATES.has(value.trim().toUpperCase());

/** 5-digit ZIP, or ZIP+4 with or without a hyphen. */
export const normalizeZip = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 5) {
    return digits;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return value.trim();
};

export const isUsZip = (value: string) => /^\d{5}(?:-\d{4})?$/.test(normalizeZip(value));

export const isMailingBlank = (mailing: MailingDraft) =>
  ![mailing.street, mailing.street2, mailing.city, mailing.state, mailing.postal].some((part) =>
    part.trim(),
  );

/** Street, city, state, and ZIP are present and valid. Apt is optional. */
export const mailingReady = (mailing: MailingDraft) =>
  Boolean(
    mailing.street.trim() &&
    mailing.city.trim() &&
    isUsState(mailing.state) &&
    isUsZip(mailing.postal),
  );

export const mailingProblem = (mailing: MailingDraft) =>
  isMailingBlank(mailing) || mailingReady(mailing) ? null : MAILING_INCOMPLETE;

/** Show stays off until the address is valid. A blank address stores nothing. */
export const normalizeMailing = (mailing: MailingDraft): MailingDraft => {
  if (isMailingBlank(mailing)) {
    return emptyMailing();
  }
  const next = {
    street: mailing.street.trim(),
    street2: mailing.street2.trim(),
    city: mailing.city.trim(),
    state: mailing.state.trim().toUpperCase(),
    postal: normalizeZip(mailing.postal),
    show: false,
  };
  next.show = mailingReady(next) ? mailing.show : false;
  return next;
};

/** Directory listing needs a visibility wider than Only me. */
export const childrenDirectoryEnabled = (visibility: ProfileVisibility) => visibility !== 'only_me';

export const normalizeShowChildren = (visibility: ProfileVisibility, show: boolean) =>
  childrenDirectoryEnabled(visibility) && show;

type ChurchLike = { id?: unknown; name?: unknown };

const exactFranconiaId = (church: ChurchLike | null | undefined): number | null => {
  if (!church || typeof church.name !== 'string' || church.name.trim() !== FRANCONIA_CHURCH_NAME) {
    return null;
  }
  return typeof church.id === 'number' ? church.id : null;
};

/**
 * Franconia membership id: the profile church when it is already Franconia,
 * otherwise an exact-name match from the churches list.
 */
export const franconiaChurchId = (
  membership: ChurchLike | null | undefined,
  listed: readonly ChurchLike[] = [],
): number | null => {
  const current = exactFranconiaId(membership);
  if (current != null) {
    return current;
  }
  for (const church of listed) {
    const id = exactFranconiaId(church);
    if (id != null) {
      return id;
    }
  }
  return null;
};

const textField = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
};

const hasField = (source: Record<string, unknown>, keys: string[]) =>
  keys.some((key) => Object.prototype.hasOwnProperty.call(source, key));

/** Reads mailing fields when the API sends them. Missing keys stay unknown so a refetch cannot wipe a local draft. */
export const mailingFromProfile = (
  profile: Record<string, unknown> | null | undefined,
): { known: boolean; mailing: MailingDraft } => {
  if (!profile) {
    return { known: false, mailing: emptyMailing() };
  }
  const keys = [
    'mailing_street',
    'mailingStreet',
    'mailing_street2',
    'mailingStreet2',
    'mailing_city',
    'mailingCity',
    'mailing_state',
    'mailingState',
    'mailing_postal',
    'mailingPostal',
    'show_mailing_address',
    'showMailingAddress',
  ];
  if (!hasField(profile, keys)) {
    return { known: false, mailing: emptyMailing() };
  }
  return {
    known: true,
    mailing: normalizeMailing({
      street: textField(profile, 'mailing_street', 'mailingStreet'),
      street2: textField(profile, 'mailing_street2', 'mailingStreet2'),
      city: textField(profile, 'mailing_city', 'mailingCity'),
      state: textField(profile, 'mailing_state', 'mailingState'),
      postal: textField(profile, 'mailing_postal', 'mailingPostal'),
      show: profile.show_mailing_address === true || profile.showMailingAddress === true,
    }),
  };
};

export type ProfileSaveInput = {
  sex: ProfileSex;
  churchId: number | null;
  mailing: MailingDraft;
  showHouseholdInDirectory: boolean;
  visibility: ProfileVisibility;
};

/**
 * PATCH body. `sex` is `male`, `female`, or empty.
 * Church id is included only when Franconia is known.
 * Mailing and directory flags use the Backend field names. Servers that do not
 * have those columns yet ignore the extra keys.
 */
export const profileSaveBody = (input: ProfileSaveInput) => {
  const mailing = normalizeMailing(input.mailing);
  const body: {
    sex: ProfileSex;
    church_id?: number;
    mailing_street: string;
    mailing_street2: string;
    mailing_city: string;
    mailing_state: string;
    mailing_postal: string;
    show_mailing_address: boolean;
    show_household_in_directory: boolean;
  } = {
    sex: input.sex,
    mailing_street: mailing.street,
    mailing_street2: mailing.street2,
    mailing_city: mailing.city,
    mailing_state: mailing.state,
    mailing_postal: mailing.postal,
    show_mailing_address: mailing.show,
    show_household_in_directory: normalizeShowChildren(
      input.visibility,
      input.showHouseholdInDirectory,
    ),
  };
  if (input.churchId != null) {
    body.church_id = input.churchId;
  }
  return body;
};

/** Member-profile address. Blank when the API omitted it (not opted in, or the viewer cannot see it). */
export const formatMailingAddress = (
  value:
    | string
    | {
        street?: string | null;
        street2?: string | null;
        city?: string | null;
        state?: string | null;
        postal?: string | null;
      }
    | null
    | undefined,
): string | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  const street = value.street?.trim() ?? '';
  const city = value.city?.trim() ?? '';
  if (!street || !city) {
    return null;
  }
  const street2 = value.street2?.trim() ?? '';
  const state = value.state?.trim().toUpperCase() ?? '';
  const postal = value.postal?.trim() ?? '';
  const place = [city, [state, postal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, street2, place].filter(Boolean).join('\n');
};
