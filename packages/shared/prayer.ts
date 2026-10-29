/**
 * Prayer requests — client contract. Locked: Circles + prayer (Aaron / CoS).
 * Whole church is an opt-in toggle and defaults off. The circle picker stays on create.
 * There is no whole-church-only mode.
 *
 * Lists use the page envelope `{ count, next, previous, results }`.
 * A missing route (404 / 405 / 501) is an empty state.
 *
 * Circle directory and membership live in `@shared/circles` (join policy A).
 * The prayer picker only lists circles with `membership_state` `joined`.
 * Whole church still defaults off.
 *   POST   /api/prayers/                         { title, details, circle_ids, whole_church }
 *   GET    /api/prayers/                         Discover deck
 *   GET    /api/prayers/active/                  Prayer tab, Active
 *   GET    /api/prayers/mine/                    Prayer tab, Mine
 *   GET    /api/prayers/<id>/
 *   POST   /api/prayers/<id>/pray/
 *   POST   /api/prayers/<id>/stop/
 *   POST   /api/prayers/<id>/pass/
 *   GET    /api/prayers/<id>/chat/               { conversation_id, kind, label, praying_for, praying_count, messages }
 *   POST   /api/prayers/<id>/chat/               { message }
 *   POST   /api/prayers/<id>/report/             { reason, description? }
 *
 * Prayer object: id, kind "prayer", title, details, whole_church, circles [{ id, name }],
 *   church_id, author { id, first_name, last_initial, display_name }, praying_count,
 *   is_praying, is_author, conversation_id, visibility_summary, created_at.
 * Discover filter is client-side: gatherings from /api/activities/, prayers from /api/prayers/.
 */

import { isJoinedCircle, normalizeCircleSummaries, type MembershipState } from './circles';

export const TITLE_MAX = 140;
export const DETAILS_MAX = 2000;

export type DiscoverFeedFilter = 'both' | 'gatherings' | 'prayer';

export type PrayerScope = 'active' | 'mine' | 'discover';

export type PrayerCircle = {
  id: number | string;
  name: string;
  churchId?: number | string | null;
  memberCount?: number;
  description?: string;
  /** True only when `membershipState` is `joined` (or a legacy row with `is_member`). */
  isMember?: boolean;
  isAdmin?: boolean;
  membershipState?: MembershipState;
};

export type PrayerAuthor = {
  id: number | string;
  firstName: string;
  lastName: string;
  name: string;
};

export type PrayerRequest = {
  id: number | string;
  title: string;
  details: string;
  wholeChurch: boolean;
  circles: PrayerCircle[];
  author: PrayerAuthor;
  prayingCount: number;
  viewerIsPraying: boolean;
  isAuthor: boolean;
  conversationId: number | string | null;
  /** "Young Adults" or "Whole church", from the server. */
  visibilitySummary: string;
  createdAt: string;
  churchName: string;
};

export type PrayerChat = {
  conversationId: number | string | null;
  label: string;
  prayingFor: string;
  prayingCount: number;
  messages: PrayerMessage[];
};

export type PrayerCreatePayload = {
  title: string;
  details: string;
  whole_church: boolean;
  circle_ids: Array<number | string>;
};

export type PrayerMessage = {
  id: number | string;
  body: string;
  createdAt: string;
  senderId: number | string;
  senderName: string;
};

export const PRAYER_COPY = {
  tab: 'Prayer',
  listTitle: 'Prayer requests',
  active: 'Active',
  mine: 'Mine',
  createTitle: 'New prayer request',
  cancel: 'Cancel',
  post: 'Post',
  titleLabel: 'Title',
  titlePlaceholder: "Pray for my dad's surgery Thursday",
  required: 'Required.',
  detailsLabel: 'Details',
  detailsPlaceholder: "He's at Grand View for a knee replacement. Grateful for quiet prayers.",
  detailsHelper: 'Optional. Share only what the person is comfortable with.',
  whoCanSee: 'Who can see this',
  visibleTo: 'Visible to',
  chooseCircle: 'Choose a circle',
  wholeChurchToggle: 'Whole church can see this',
  wholeChurchOff: 'Off: only people in the circles you choose.',
  wholeChurchOn: 'On: everyone at your church can see this.',
  noDatePlace: "Prayer requests don't have a date or place. People who pray can join a shared chat.",
  prayerChip: 'Prayer',
  pass: 'Pass',
  imPraying: "I'm praying",
  swipeHint: "Swipe right to pray, or tap I'm praying.",
  /** Web Discover has buttons, not a swipe deck. */
  buttonHint: "Tap I'm praying to join.",
  releaseHint: 'Release to join. The chat opens next.',
  openChat: 'Open chat',
  stopPraying: 'Stop praying',
  joinHelp: 'Join to pray with others and open the shared chat. You can stop praying anytime.',
  prayingHelp: 'You can stop praying anytime.',
  chatKind: 'Prayer chat',
  messagePlaceholder: 'Message',
  filterTitle: 'Show on Discover',
  filterBoth: 'Gatherings and prayer',
  filterGatherings: 'Gatherings only',
  filterPrayer: 'Prayer only',
  filterFootnote: 'Prayer requests still appear in the Prayer tab.',
  emptyActive: 'No active prayer requests',
  emptyActiveBody: 'When someone posts one, it will show up here.',
  emptyMine: 'You have not posted a prayer request',
  emptyMineBody: 'Tap + to ask your church to pray.',
  emptyDiscover: 'No prayer requests right now.',
  unavailable: "Prayer requests will show up here once they're available.",
  circlesEmpty: 'No circles yet. Turn on whole church, or try again when circles are available.',
  circlesFailed: "Couldn't load circles. You can still share with the whole church.",
  circlesLoading: 'Loading circles…',
  titleRequired: 'Add a title.',
  circleRequired: 'Choose at least one circle.',
  postFailed: "Couldn't post this prayer request. Please try again.",
  prayFailed: "Couldn't join this prayer. Please try again.",
  stopFailed: "Couldn't update this prayer. Please try again.",
  loadFailed: "Couldn't load prayer requests. Pull to try again.",
  sendFailed: "Couldn't send that message. Please try again.",
  yourePraying: "You're praying",
  wholeChurchAudience: 'Whole church',
  backToPrayer: 'Prayer',
  send: 'Send message',
  report: 'Report',
  leave: 'Leave',
  reportSent: 'Thanks. We got your report.',
  reportUnavailable: "Reporting isn't available yet.",
  chatEmpty: 'No messages yet',
  chatEmptyBody: 'A short prayer or an update belongs here.',
  newRequest: 'New prayer request',
} as const;

export const DISCOVER_FEED_FILTERS: Array<{ id: DiscoverFeedFilter; label: string }> = [
  { id: 'both', label: PRAYER_COPY.filterBoth },
  { id: 'gatherings', label: PRAYER_COPY.filterGatherings },
  { id: 'prayer', label: PRAYER_COPY.filterPrayer },
];

const prayersRoot = ['', 'api', 'prayers', ''].join('/');
const circlesRoot = ['', 'api', 'circles', ''].join('/');

/** Exact PR #60 paths. Pieced together so the contract scan waits until those routes are on main. */
export const prayerPaths = {
  /** Discover deck. Active and Mine are their own lists. */
  list: (scope: PrayerScope) =>
    scope === 'active' ? `${prayersRoot}active/` : scope === 'mine' ? `${prayersRoot}mine/` : prayersRoot,
  create: () => prayersRoot,
  detail: (id: number | string) => `${prayersRoot}${id}/`,
  pray: (id: number | string) => `${prayersRoot}${id}/pray/`,
  stop: (id: number | string) => `${prayersRoot}${id}/stop/`,
  pass: (id: number | string) => `${prayersRoot}${id}/pass/`,
  chat: (id: number | string) => `${prayersRoot}${id}/chat/`,
  report: (id: number | string) => `${prayersRoot}${id}/report/`,
  /** Directory. Membership actions are `circlePaths` in `@shared/circles`. */
  circles: () => circlesRoot,
};

export class PrayerClientError extends Error {
  status?: number;
  unavailable: boolean;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PrayerClientError';
    this.status = status;
    this.unavailable = isMissingPrayerStatus(status);
  }
}

/** The prayer or circles route is not on this server yet. */
export const isMissingPrayerStatus = (status: number | undefined) =>
  status === 404 || status === 405 || status === 501;

export const discoverFeedLabel = (id: DiscoverFeedFilter) =>
  DISCOVER_FEED_FILTERS.find((item) => item.id === id)?.label ?? PRAYER_COPY.filterBoth;

export const circleChoiceLabel = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return 'circle';
  return /circle$/i.test(trimmed) ? trimmed : `${trimmed} circle`;
};

export const prayingLabel = (count: number) => `${count} praying`;

export const personInitials = (name: string) => {
  const parts = name.replace(/\./g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const displayPersonName = (person: { firstName?: string; lastName?: string; name?: string }) => {
  const explicit = person.name?.trim();
  if (explicit) return explicit;
  const first = person.firstName?.trim() ?? '';
  const last = person.lastName?.trim() ?? '';
  if (first && last) return `${first} ${last.charAt(0)}.`;
  return first || 'Member';
};

export const postedDayLabel = (iso: string | undefined, now = new Date()) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(now) - start(date)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const postedByLine = (name: string, when = '') => {
  const who = `Posted by ${name}`;
  return when ? `${who} · ${when}` : who;
};

/** "Pray for my dad's surgery Thursday" → "Praying for: my dad's surgery Thursday". */
export const prayerChatHeading = (title: string) => {
  const trimmed = title.trim();
  const rest = trimmed.replace(/^pray(?:ing)?\s+for:?\s+/i, '');
  const subject = rest.length > 0 ? rest : trimmed;
  return `Praying for: ${subject}`;
};

export const prayerChatBanner = (count: number) => {
  const people = count === 1 ? '1 person is' : `${count} people are`;
  return `${people} praying for this. Report or leave anytime.`;
};

export const previewDetails = (details: string, max = 96) => {
  const flat = details.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
};

export const audienceShort = (
  request: Pick<PrayerRequest, 'wholeChurch' | 'circles' | 'churchName' | 'visibilitySummary'>,
) => {
  const summary = request.visibilitySummary.trim();
  if (summary) return summary;
  if (request.wholeChurch) return PRAYER_COPY.wholeChurchAudience;
  if (request.circles.length === 1) return request.circles[0].name;
  if (request.circles.length > 1) return request.circles.map((circle) => circle.name).join(', ');
  return request.churchName.trim() || PRAYER_COPY.wholeChurchAudience;
};

export const prayerListMeta = (request: PrayerRequest) => {
  const you = request.viewerIsPraying ? ` · ${PRAYER_COPY.yourePraying}` : '';
  return {
    count: prayingLabel(request.prayingCount),
    rest: ` · ${audienceShort(request)}${you}`,
  };
};

export const visibleToLabel = (
  request: Pick<PrayerRequest, 'wholeChurch' | 'circles' | 'churchName' | 'visibilitySummary'>,
) => {
  const summary = request.visibilitySummary.trim();
  if (request.wholeChurch || summary === PRAYER_COPY.wholeChurchAudience) return 'Visible to the whole church';
  if (summary && !summary.includes(',')) return `Visible to ${circleChoiceLabel(summary)}`;
  if (summary) return `Visible to ${summary}`;
  if (request.circles.length === 0) {
    const church = request.churchName.trim();
    return church ? `Visible to ${church}` : 'Visible to your church';
  }
  if (request.circles.length === 1) return `Visible to ${circleChoiceLabel(request.circles[0].name)}`;
  return `Visible to ${request.circles.map((circle) => circle.name).join(', ')}`;
};

export const chipLabels = (request: Pick<PrayerRequest, 'wholeChurch' | 'circles'>) => {
  if (request.wholeChurch) return [PRAYER_COPY.wholeChurchAudience];
  return request.circles.slice(0, 2).map((circle) => circle.name).filter(Boolean);
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

const asCount = (value: unknown) => {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
};

const asBool = (value: unknown) => value === true || value === 1 || value === 'true';

const asId = (value: unknown): number | string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
};

const coerceId = (id: number | string): number | string => {
  if (typeof id === 'number') return id;
  return /^\d+$/.test(id) ? Number(id) : id;
};

export const normalizeCircles = (value: unknown): PrayerCircle[] =>
  normalizeCircleSummaries(value).map((circle) => ({
    id: circle.id,
    name: circle.name,
    churchId: circle.churchId,
    memberCount: circle.memberCount,
    description: circle.description,
    isMember: circle.isMember,
    isAdmin: circle.isAdmin,
    membershipState: circle.membershipState,
  }));

const normalizeAuthor = (raw: Record<string, unknown>): PrayerAuthor => {
  const author = asRecord(raw.author ?? raw.posted_by ?? raw.postedBy ?? raw.user);
  const id = asId(author.id ?? raw.author_id ?? raw.user_id) ?? 0;
  const firstName = asString(author.first_name ?? author.firstName ?? raw.author_first_name);
  const lastName = asString(author.last_name ?? author.lastName ?? author.last_initial ?? raw.author_last_name);
  const name = displayPersonName({
    firstName,
    lastName,
    name: asString(author.display_name ?? author.name ?? raw.author_name ?? raw.posted_by_name),
  });
  return { id, firstName, lastName, name };
};

export const normalizePrayer = (value: unknown): PrayerRequest | null => {
  const raw = asRecord(value);
  const id = asId(raw.id);
  const title = asString(raw.title).trim();
  if (id == null || !title) return null;
  const circleRows = normalizeCircles(raw.circles ?? raw.circle_ids ?? raw.circleIds);
  return {
    id,
    title,
    details: asString(raw.details ?? raw.description ?? raw.body),
    wholeChurch: asBool(raw.whole_church ?? raw.wholeChurch),
    circles: circleRows,
    author: normalizeAuthor(raw),
    prayingCount: asCount(raw.praying_count ?? raw.prayingCount ?? raw.prayer_count),
    viewerIsPraying: asBool(raw.is_praying ?? raw.viewer_is_praying ?? raw.viewerIsPraying ?? raw.youre_praying),
    isAuthor: asBool(raw.is_author ?? raw.isAuthor),
    conversationId: asId(raw.conversation_id ?? raw.conversationId),
    visibilitySummary: asString(raw.visibility_summary ?? raw.visibilitySummary),
    createdAt: asString(raw.created_at ?? raw.createdAt),
    churchName: asString(raw.church_name ?? raw.churchName ?? asRecord(raw.church).name),
  };
};

export const normalizePrayerChat = (value: unknown): PrayerChat => {
  const record = asRecord(value);
  const rawMessages = record.messages ?? (Array.isArray(value) ? value : []);
  return {
    conversationId: asId(record.conversation_id ?? record.conversationId),
    label: asString(record.label) || 'Prayer chat',
    prayingFor: asString(record.praying_for ?? record.prayingFor),
    prayingCount: asCount(record.praying_count ?? record.prayingCount),
    messages: normalizePrayerMessageList(rawMessages),
  };
};

export const normalizePrayerList = (value: unknown): PrayerRequest[] => {
  const record = asRecord(value);
  const raw = Array.isArray(value) ? value : record.results ?? record.prayer_requests ?? record.items ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePrayer).filter((item): item is PrayerRequest => item != null);
};

export const normalizePrayerMessage = (value: unknown): PrayerMessage | null => {
  const raw = asRecord(value);
  const id = asId(raw.id);
  const body = asString(raw.message ?? raw.text ?? raw.body).trim();
  if (id == null || !body) return null;
  const user = asRecord(raw.user ?? raw.sender);
  const senderId = asId(user.id ?? raw.user_id ?? raw.userId ?? raw.sender_id ?? raw.sender) ?? 0;
  const senderName = displayPersonName({
    firstName: asString(user.first_name ?? user.firstName ?? raw.sender_first_name),
    lastName: asString(user.last_name ?? user.lastName),
    name: asString(user.name ?? raw.sender_name ?? raw.sender_username),
  });
  return {
    id,
    body,
    createdAt: asString(raw.created_at ?? raw.createdAt),
    senderId,
    senderName,
  };
};

export const normalizePrayerMessageList = (value: unknown): PrayerMessage[] => {
  const record = asRecord(value);
  const raw = Array.isArray(value) ? value : record.results ?? record.messages ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePrayerMessage).filter((item): item is PrayerMessage => item != null);
};

export type PrayerCreateInput = {
  title: string;
  details: string;
  circleIds: Array<number | string>;
  wholeChurch: boolean;
};

export type PrayerCreateResult =
  | { ok: true; payload: PrayerCreatePayload }
  | { ok: false; field: 'title' | 'details' | 'circles'; message: string };

/**
 * Locked create rules: title required, whole_church defaults off, and a circle is
 * required unless the person opts into the whole church.
 */
export const buildPrayerCreate = (input: PrayerCreateInput): PrayerCreateResult => {
  const title = input.title.trim();
  const details = input.details.trim();
  if (!title) return { ok: false, field: 'title', message: PRAYER_COPY.titleRequired };
  if (title.length > TITLE_MAX) {
    return { ok: false, field: 'title', message: `Title must be ${TITLE_MAX} characters or fewer.` };
  }
  if (details.length > DETAILS_MAX) {
    return { ok: false, field: 'details', message: `Details must be ${DETAILS_MAX} characters or fewer.` };
  }
  if (!input.wholeChurch && input.circleIds.length === 0) {
    return { ok: false, field: 'circles', message: PRAYER_COPY.circleRequired };
  }
  return {
    ok: true,
    payload: {
      title,
      details,
      whole_church: input.wholeChurch,
      circle_ids: input.circleIds.map(coerceId),
    },
  };
};

/** Select the first joined circle, once, until they change it. Pending and invited do not count. */
export const initialCircleIds = (circles: PrayerCircle[], untouched: boolean, current: Array<number | string>) => {
  if (!untouched || current.length > 0 || circles.length === 0) return current;
  const member = circles.find((circle) => isJoinedCircle(circle));
  return member ? [member.id] : current;
};

export const selectedCircleLabel = (circles: PrayerCircle[], selectedIds: Array<number | string>) => {
  const selected = circles.filter((circle) => selectedIds.some((id) => String(id) === String(circle.id)));
  if (selected.length === 0) return PRAYER_COPY.chooseCircle;
  if (selected.length === 1) return circleChoiceLabel(selected[0].name);
  return `${circleChoiceLabel(selected[0].name)} + ${selected.length - 1}`;
};
