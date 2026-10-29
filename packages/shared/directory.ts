/**
 * Church Directory — client contract.
 *
 * Entry is Profile → Directory. Directory is not a bottom tab.
 * Shell tabs stay Discover · Gatherings · Prayer · Voting · Profile.
 *
 * `GET /api/directory/?q=&page=` is Backend #73 (see FOYER_API_CONTRACT.md). Page size is 20.
 * Rows: `{ id, first_name, last_initial, avatar_url, household_children }`.
 * Children are never top-level results. Each child is `{ id, first_name, birth_month, birth_day }`.
 * This module drops any year, last name, photo, sex, email, phone, or address on a child.
 *
 * Gaps still open after #73:
 * - Adult list rows do not include a birthday. `Birthdays this week` can list children from
 *   `household_children`. An adult is included only when a row carries `birthday: { month, day }`
 *   with no year. The live list does not send that object.
 * - `POST /api/directory/wishes/` `{ child_id }` is specified and not implemented. No chat `style`
 *   field exists. Wish falls back to a plain 1:1 to the parent, with the child's name in the text,
 *   and only when the viewer is already friends with that parent.
 * - A non-Franconia viewer gets 200 and an empty page. The client shows the empty-directory copy.
 */

export const DIRECTORY_SERVER_SEARCH_AFTER = 200;
export const DIRECTORY_PAGE_CAP = 10;

export const DIRECTORY_COPY = {
  title: 'Directory',
  rowHelper: 'People in our church',
  searchPlaceholder: 'Search by name',
  family: 'Family',
  birthday: (label: string) => `Birthday ${label}`,
  today: 'Today',
  weekTitle: 'Birthdays this week',
  childOf: (parent: string) => `Child of ${parent}`,
  loading: 'Loading the directory',
  emptyTitle: 'No one in the directory yet',
  emptyBody:
    'People show up here when they set Who can see my profile to People in my church.',
  updateVisibility: 'Update my visibility',
  viewerTitle: "You're not in the directory",
  viewerBody: 'Change Who can see my profile to People in my church to be listed.',
  viewerUpdate: 'Update',
  searchEmpty: 'No one found. Try another name.',
  errorTitle: "Couldn't load the directory.",
  tryAgain: 'Try again',
  listedChurch: "You'll be listed in the church Directory.",
  listedHidden: "You won't appear in the Directory.",
  showMore: 'Show more',
  wishSent: 'Sent',
  wishFailed: "Couldn't send that wish. Try again.",
  addFriend: 'Add friend',
} as const;

export const DIRECTORY_BACKEND_GAPS = [
  'Adult Directory rows have no birthday. Birthdays this week lists opted-in children; adults need birthday: { month, day } on the row, which GET /api/directory/ does not send.',
  'POST /api/directory/wishes/ is not a route. A wish is a plain 1:1 message to the parent (friends only). style: birthday_card is not stored.',
  '404, 405, or 501 from GET /api/directory/ is a load error (the list route is missing). An empty 200 is a real empty directory.',
] as const;

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export type DirectoryChild = {
  id: number | string;
  firstName: string;
  birthMonth: number;
  birthDay: number;
};

export type DirectoryMember = {
  id: number | string;
  firstName: string;
  lastInitial: string;
  avatarUrl: string | null;
  householdChildren: DirectoryChild[];
  /** Present only when the payload included a month/day birthday object. Never a year. */
  birthdayMonth: number | null;
  birthdayDay: number | null;
};

export type DirectoryPage = {
  results: DirectoryMember[];
  count: number | null;
  nextPath: string | null;
};

export type DirectorySection = {
  letter: string;
  members: DirectoryMember[];
};

export type WeekBirthday = {
  key: string;
  kind: 'adult' | 'child';
  name: string;
  month: number;
  day: number;
  daysUntil: number;
  memberId: number | string;
  childId?: number | string;
  parentName?: string;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const asId = (value: unknown): number | string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
};

export const validMonthDay = (month: number, day: number) =>
  Number.isInteger(month) &&
  Number.isInteger(day) &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= MONTH_LENGTHS[month - 1];

const readMonthDay = (value: unknown): { month: number; day: number } | null => {
  const record = asRecord(value);
  if (!record) return null;
  const month = record.month ?? record.birth_month;
  const day = record.day ?? record.birth_day;
  if (typeof month !== 'number' || typeof day !== 'number' || !validMonthDay(month, day)) return null;
  return { month, day };
};

export const birthdayShort = (month: number, day: number) =>
  validMonthDay(month, day) ? `${SHORT_MONTHS[month - 1]} ${day}` : '';

export const birthdayLong = (month: number, day: number) =>
  validMonthDay(month, day) ? `${LONG_MONTHS[month - 1]} ${day}` : '';

export const directoryDisplayName = (member: { firstName: string; lastInitial: string }) => {
  const first = member.firstName.trim();
  const initial = member.lastInitial.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
};

export const childInitials = (firstName: string) => {
  const parts = firstName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return letters.join('') || '?';
};

export const directoryListingNudge = (visibility: string) =>
  visibility === 'church' ? DIRECTORY_COPY.listedChurch : DIRECTORY_COPY.listedHidden;

export const showDirectoryViewerCard = (visibility: string | null | undefined) => visibility === 'only_me';

export const directoryUsesServerSearch = (count: number | null | undefined, loaded: number) =>
  (count ?? loaded) > DIRECTORY_SERVER_SEARCH_AFTER;

export const directoryMemberMatches = (member: DirectoryMember, query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const first = member.firstName.trim().toLowerCase();
  const initial = member.lastInitial.replace(/[^A-Za-z]/g, '').toLowerCase();
  const labeled = directoryDisplayName(member).toLowerCase();
  return first.includes(needle) || labeled.includes(needle) || `${first} ${initial}`.includes(needle);
};

export const filterDirectory = (members: DirectoryMember[], query: string) =>
  members.filter((member) => directoryMemberMatches(member, query));

export const directorySections = (members: DirectoryMember[]): DirectorySection[] => {
  const sorted = [...members].sort((a, b) => {
    const byName = a.firstName.localeCompare(b.firstName, 'en', { sensitivity: 'base' });
    return byName || String(a.id).localeCompare(String(b.id), 'en');
  });
  const groups = new Map<string, DirectoryMember[]>();
  for (const member of sorted) {
    const char = member.firstName.trim().charAt(0).toUpperCase();
    const letter = /^[A-Z]$/.test(char) ? char : '#';
    const rows = groups.get(letter) ?? [];
    rows.push(member);
    groups.set(letter, rows);
  }
  return [...groups.entries()].map(([letter, rows]) => ({ letter, members: rows }));
};

/** Days until the next month/day, including today as 0. Feb 29 in a non-leap year does not match. */
export const daysUntilBirthday = (month: number, day: number, now = new Date()): number | null => {
  if (!validMonthDay(month, day)) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = 0; offset < 366; offset += 1) {
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    if (cursor.getMonth() + 1 === month && cursor.getDate() === day) return offset;
  }
  return null;
};

export const isBirthdayToday = (month: number, day: number, now = new Date()) =>
  daysUntilBirthday(month, day, now) === 0;

export const birthdaysThisWeek = (members: DirectoryMember[], now = new Date()): WeekBirthday[] => {
  const items: WeekBirthday[] = [];
  for (const member of members) {
    if (member.birthdayMonth != null && member.birthdayDay != null) {
      const daysUntil = daysUntilBirthday(member.birthdayMonth, member.birthdayDay, now);
      if (daysUntil != null && daysUntil < 7) {
        items.push({
          key: `adult-${member.id}`,
          kind: 'adult',
          name: directoryDisplayName(member),
          month: member.birthdayMonth,
          day: member.birthdayDay,
          daysUntil,
          memberId: member.id,
        });
      }
    }
    for (const child of member.householdChildren) {
      const daysUntil = daysUntilBirthday(child.birthMonth, child.birthDay, now);
      if (daysUntil == null || daysUntil >= 7) continue;
      items.push({
        key: `child-${member.id}-${child.id}`,
        kind: 'child',
        name: child.firstName,
        month: child.birthMonth,
        day: child.birthDay,
        daysUntil,
        memberId: member.id,
        childId: child.id,
        parentName: directoryDisplayName(member),
      });
    }
  }
  return items.sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name, 'en'));
};

export const wishPresets = (firstName: string) => [
  `Happy birthday, ${firstName}!`,
  `Thinking of ${firstName} on their birthday.`,
  `Hope ${firstName} has a wonderful birthday.`,
];

export const wishButtonLabel = (firstName: string) => `Wish ${firstName} a happy birthday`;

export const wishFriendsLine = (parentFirstName: string) =>
  `You can send birthday wishes when you're friends with ${parentFirstName}.`;

const normalizeChild = (raw: unknown): DirectoryChild | null => {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asId(record.id);
  const firstName = typeof record.first_name === 'string' ? record.first_name.trim() : typeof record.firstName === 'string' ? record.firstName.trim() : '';
  const birthday = readMonthDay({
    month: record.birth_month ?? record.birthMonth,
    day: record.birth_day ?? record.birthDay,
  });
  if (id == null || !firstName || !birthday) return null;
  return { id, firstName, birthMonth: birthday.month, birthDay: birthday.day };
};

const normalizeMember = (raw: unknown): DirectoryMember | null => {
  const record = asRecord(raw);
  if (!record) return null;
  const id = asId(record.id);
  const firstName =
    typeof record.first_name === 'string'
      ? record.first_name.trim()
      : typeof record.firstName === 'string'
        ? record.firstName.trim()
        : '';
  if (id == null || !firstName) return null;
  const initialSource = record.last_initial ?? record.lastInitial;
  const lastInitial = typeof initialSource === 'string' ? initialSource.trim().slice(0, 1).toUpperCase() : '';
  const avatarSource = record.avatar_url ?? record.avatarUrl;
  const avatarUrl = typeof avatarSource === 'string' && avatarSource.trim() ? avatarSource.trim() : null;
  const childrenRaw = record.household_children ?? record.householdChildren;
  const householdChildren = Array.isArray(childrenRaw)
    ? childrenRaw.map(normalizeChild).filter((child): child is DirectoryChild => child != null)
    : [];
  const birthday = readMonthDay(record.birthday);
  return {
    id,
    firstName,
    lastInitial,
    avatarUrl,
    householdChildren,
    birthdayMonth: birthday?.month ?? null,
    birthdayDay: birthday?.day ?? null,
  };
};

export const directoryNextPath = (next: unknown): string | null => {
  if (typeof next !== 'string' || !next.trim()) return null;
  if (next.startsWith('http://') || next.startsWith('https://')) {
    try {
      const url = new URL(next);
      return `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }
  return next.startsWith('/') ? next : null;
};

export const directoryQuery = (input: { q?: string; page?: number } = {}) => {
  const params = new URLSearchParams();
  const q = input.q?.trim();
  if (q) params.set('q', q);
  if (input.page && input.page > 1) params.set('page', String(input.page));
  const query = params.toString();
  return query ? `/api/directory/?${query}` : '/api/directory/';
};

export const normalizeDirectoryPage = (raw: unknown): DirectoryPage => {
  if (Array.isArray(raw)) {
    return {
      results: raw.map(normalizeMember).filter((row): row is DirectoryMember => row != null),
      count: null,
      nextPath: null,
    };
  }
  const record = asRecord(raw) ?? {};
  const rows = Array.isArray(record.results) ? record.results : [];
  return {
    results: rows.map(normalizeMember).filter((row): row is DirectoryMember => row != null),
    count: typeof record.count === 'number' ? record.count : null,
    nextPath: directoryNextPath(record.next),
  };
};

export const mergeDirectoryMembers = (pages: DirectoryMember[][]) => {
  const seen = new Set<string>();
  const merged: DirectoryMember[] = [];
  for (const page of pages) {
    for (const member of page) {
      const key = String(member.id);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(member);
    }
  }
  return merged;
};

export const isMissingDirectoryStatus = (status: number | null | undefined) =>
  status === 404 || status === 405 || status === 501;

/** JSON of a normalized page must not carry a birth year or other child secrets. */
export const directoryPayloadLeaksPrivateChildData = (value: unknown) => {
  const text = JSON.stringify(value);
  return /birth_year|birthYear|"year"|date_of_birth|dateOfBirth|last_name|lastName|"sex"|avatar_url|email|phone|mailing/i.test(
    text,
  );
};
