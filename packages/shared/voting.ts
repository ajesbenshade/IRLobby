/**
 * Voting tab — client contract for the live ballots API.
 * Same chrome as Gatherings and Prayer. Audience is circles the caller admins,
 * or whole church only when a church admin opts in. One cast per account.
 *
 *   GET    /api/votes/ballots/                 { open, closed }
 *   POST   /api/votes/ballots/                 create
 *   GET    /api/votes/ballots/<id>/
 *   POST   /api/votes/ballots/<id>/vote/       { choice_id }
 *   POST   /api/votes/ballots/<id>/close/      close early
 *   GET    /api/circles/                       directory; reads is_admin
 *
 * A non-voting member (null voting_member_attested_at) gets `{ open: [], closed: [] }`
 * on the list, or 403 `{ code: "not_voting_member" }` on create. Either one is the
 * empty Voting tab, not an error. `vote_count` and `total_votes` are null while
 * hidden. Null is not zero. The payload never includes who voted.
 */

export const TITLE_MAX = 140;
export const DESCRIPTION_MAX = 2000;
export const OPTION_MIN = 2;
export const OPTION_MAX = 6;

export const DEFAULT_OPTIONS = ['Yes', 'No'];

export const RUBRIC_SEEN_KEY = 'foyer.voting.rubric.posted';

export type ResultsMode = 'after_close' | 'live';

export type VoteAudience = 'church' | 'circles';

export type VoteCircle = {
  id: number | string;
  name: string;
  isMember?: boolean;
  /** True only when the caller admins this circle. Create offers these. */
  isAdmin?: boolean;
};

export type VoteOption = {
  id: number | string;
  label: string;
  /** Null while the server is withholding the tally. */
  count: number | null;
};

export type Vote = {
  id: number | string;
  title: string;
  description: string;
  closesAt: string;
  closedAt: string | null;
  resultsMode: ResultsMode;
  audience: VoteAudience;
  circles: VoteCircle[];
  churchName: string;
  options: VoteOption[];
  myOptionId: number | string | null;
  hasVoted: boolean;
  canClose: boolean;
  /**
   * From `total_votes`. Null means the API is hiding the tally.
   * Undefined means this payload did not include the field.
   */
  totalVotes?: number | null;
  /** From `results_visible`. False hides counts, including for a manager view that has not opened them. */
  resultsVisible?: boolean | null;
  /** From `can_vote`. False locks the ballot for this account. */
  canVote?: boolean | null;
  /** Null when the payload leaves open vs closed to the close time. */
  status: 'open' | 'closed' | null;
  createdAt: string;
};

export type VoteCreatePayload = {
  title: string;
  description: string;
  choices: string[];
  whole_church: boolean;
  circle_ids: Array<number | string>;
  closes_at: string;
  results_mode: ResultsMode;
};

export type VoteCreateInput = {
  title: string;
  description: string;
  options: string[];
  circleIds: Array<number | string>;
  wholeChurch: boolean;
  closesAt: string;
  resultsMode: ResultsMode;
  isChurchAdmin: boolean;
  now?: Date;
};

export type VoteCreateResult =
  | { ok: true; payload: VoteCreatePayload }
  | { ok: false; field: 'title' | 'description' | 'options' | 'audience' | 'closes'; message: string };

export const VOTING_COPY = {
  tab: 'Voting',
  title: 'Voting',
  createTitle: 'Create a vote',
  newVote: 'Create a vote',
  cancel: 'Cancel',
  post: 'Post vote',
  titleLabel: 'Title',
  titlePlaceholder: 'Affirm the 2027 budget',
  required: 'Required.',
  descriptionLabel: 'Description',
  descriptionPlaceholder: 'Optional context for the people voting.',
  descriptionHelper: 'Optional.',
  choicesLabel: 'Choices',
  addOption: 'Add option',
  removeOption: 'Remove option',
  whoVotes: 'Who votes',
  chooseWho: 'Choose who votes',
  wholeChurch: 'Whole church',
  wholeChurchOff: 'Off: only the circles you choose.',
  wholeChurchOn: 'On: everyone at your church can vote.',
  circlesLoading: 'Loading circles…',
  circlesEmpty: 'No circles you admin yet.',
  circlesFailed: "Couldn't load circles. Try again.",
  closesLabel: 'Closes',
  date: 'Date',
  time: 'Time',
  resultsLabel: 'Results',
  resultsAfter: 'After the vote closes',
  resultsLive: 'Live while open',
  resultsHidden: 'Results show after the vote closes.',
  rubricTitle: 'Before you post',
  openSection: 'Open',
  closedSection: 'Closed',
  sectionEmpty: 'Nothing here yet.',
  voted: 'Voted',
  chip: 'Voting',
  emptyTitle: 'No votes yet',
  emptyBody: 'When your circles or the church post a vote, it shows up here.',
  loadFailed: "Couldn't load votes.",
  tryAgain: 'Try again',
  submit: 'Submit vote',
  submitted: 'Vote submitted.',
  submitOnce: 'Members submit once.',
  submitFailed: "Couldn't submit your vote. Try again.",
  closedBanner: 'Voting is closed.',
  closeVote: 'Close vote',
  closeConfirm: 'Close this vote now? People cannot vote after this.',
  closeNow: 'Close now',
  closeFailed: "Couldn't close this vote. Try again.",
  postFailed: "Couldn't post this vote. Try again.",
  titleRequired: 'Add a title.',
  optionsRequired: 'Add at least two choices.',
  optionsDistinct: 'Choices need to be different.',
  audienceRequired: 'Choose who votes.',
  churchAdminRequired: 'Whole church is for a church admin.',
  closesRequired: 'Choose a close time.',
  closesFuture: 'Close time has to be in the future.',
  selectVote: 'Select a vote',
  back: 'Voting',
  optionLabel: 'Option',
} as const;

export const VOTE_RUBRIC: Array<{ title: string; body: string }> = [
  {
    title: 'One clear question',
    body: 'The title is the motion, for example “Affirm the 2027 budget.”',
  },
  {
    title: 'Neutral choices',
    body: 'Options people can pick without leading language. Yes / No, or name distinct alternatives.',
  },
  {
    title: 'Right circle',
    body: 'Only the people who should vote: a circle you admin, or the whole church.',
  },
  {
    title: 'A real close time',
    body: 'When discussion ends. Results follow the mode you pick.',
  },
  {
    title: 'No change after vote',
    body: 'Members submit once.',
  },
];

/** Live ballots API. The server owns audience, attestation, and the one-vote lock. */
export const VOTING_BACKEND_GAPS = [
  'vote_count and total_votes stay null until results_visible. A missing count is hidden, never shown as 0.',
  'A non-voting member gets an empty list, or 403 not_voting_member. The Voting tab shows its empty state.',
  'The API does not list who voted. my_choice_id is only this account.',
] as const;

export const NOT_VOTING_MEMBER_CODE = 'not_voting_member';

export const votePaths = {
  list: () => '/api/votes/ballots/',
  create: () => '/api/votes/ballots/',
  detail: (id: number | string) => `/api/votes/ballots/${id}/`,
  vote: (id: number | string) => `/api/votes/ballots/${id}/vote/`,
  close: (id: number | string) => `/api/votes/ballots/${id}/close/`,
  circles: () => '/api/circles/',
};

export class VoteClientError extends Error {
  status?: number;
  unavailable: boolean;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'VoteClientError';
    this.status = status;
    this.unavailable = isMissingVoteStatus(status);
  }
}

/** An older server with no ballots route. */
export const isMissingVoteStatus = (status: number | undefined) =>
  status === 404 || status === 405 || status === 501;

/** Attested gate. The list itself answers 200 with two empty arrays; create answers 403. */
export const isVotingMemberDenied = (status: number | undefined, body: unknown) =>
  status === 403 && asString(asRecord(body).code) === NOT_VOTING_MEMBER_CODE;

/**
 * Empty Voting tab: the route is missing, or this account is not a voting member.
 * A normal empty church is a 200 `{ open: [], closed: [] }`, which is not an error.
 */
export const isEmptyVotingDegrade = (status: number | undefined, body?: unknown) =>
  isMissingVoteStatus(status) || isVotingMemberDenied(status, body);

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

/** A real tally, or null when the API omitted it or sent null. Never turns null into 0. */
const asCount = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.round(number));
};

const firstDefined = (...values: unknown[]) => {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
};

const asFlag = (value: unknown): boolean | null => {
  if (value === true) return true;
  if (value === false) return false;
  return null;
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const timeOf = (iso: string | null | undefined) => {
  if (!iso) return 0;
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/** `Sun, Nov 1 · 8:00 PM` in the device time zone. */
export const formatClosesAt = (iso: string | null | undefined) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours24 = date.getHours();
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()} · ${hours12}:${mins} ${suffix}`;
};

/** `Oct 28` in the device time zone. */
export const formatClosedOn = (iso: string | null | undefined) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
};

/** `datetime-local` value to an ISO instant. Empty when it does not parse. */
export const localInputToIso = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

export const isVoteOpen = (
  vote: Pick<Vote, 'status' | 'closesAt' | 'closedAt'>,
  now = new Date(),
) => {
  if (vote.status === 'closed' || vote.closedAt) return false;
  const closes = timeOf(vote.closesAt);
  if (closes > 0 && closes <= now.getTime()) return false;
  return true;
};

export const voteRowSubline = (vote: Pick<Vote, 'status' | 'closesAt' | 'closedAt'>, now = new Date()) => {
  if (!isVoteOpen(vote, now)) {
    const day = formatClosedOn(vote.closedAt || vote.closesAt);
    return day ? `Closed ${day}` : 'Closed';
  }
  const when = formatClosesAt(vote.closesAt);
  return when ? `Closes ${when}` : 'Open';
};

export const audienceChip = (vote: Pick<Vote, 'audience' | 'circles' | 'churchName'>) => {
  if (vote.audience === 'church') {
    return vote.churchName.trim() || VOTING_COPY.wholeChurch;
  }
  if (vote.circles.length === 1) return vote.circles[0].name;
  if (vote.circles.length > 1) return vote.circles.map((circle) => circle.name).join(', ');
  return vote.churchName.trim() || VOTING_COPY.wholeChurch;
};

export const detailChips = (vote: Pick<Vote, 'audience' | 'circles' | 'churchName'>) => [
  VOTING_COPY.chip,
  audienceChip(vote),
];

export const talliesVisible = (vote: Vote, now = new Date()) => {
  if (vote.resultsVisible === true) return true;
  if (vote.resultsVisible === false) return false;
  if (!isVoteOpen(vote, now)) return true;
  return vote.resultsMode === 'live';
};

/** Sum of known counts. Null when any choice is hidden, so a missing tally is not added as zero. */
export const voteTotal = (vote: Pick<Vote, 'options'>): number | null => {
  let sum = 0;
  for (const option of vote.options) {
    if (option.count == null) return null;
    sum += option.count;
  }
  return sum;
};

/** Prefer the API total. Null stays null. A payload without the field sums the choices. */
export const visibleTotal = (vote: Pick<Vote, 'options' | 'totalVotes'>): number | null => {
  if (vote.totalVotes === null) return null;
  if (typeof vote.totalVotes === 'number') return vote.totalVotes;
  return voteTotal(vote);
};

export const optionShare = (count: number | null, total: number | null) => {
  if (count == null || total == null || total <= 0) return null;
  return Math.round((count / total) * 100);
};

/** One cast, and only when the API says this account is in the audience. */
export const canCastVote = (
  vote: Pick<Vote, 'status' | 'closesAt' | 'closedAt' | 'hasVoted' | 'canVote'>,
  now = new Date(),
) => isVoteOpen(vote, now) && !vote.hasVoted && vote.canVote !== false;

export const sectionVotes = (votes: Vote[], now = new Date()) => {
  const open: Vote[] = [];
  const closed: Vote[] = [];
  for (const vote of votes) {
    (isVoteOpen(vote, now) ? open : closed).push(vote);
  }
  const byCreated = (a: Vote, b: Vote) => timeOf(b.createdAt) - timeOf(a.createdAt) || timeOf(b.closesAt) - timeOf(a.closesAt);
  open.sort(byCreated);
  closed.sort(
    (a, b) =>
      timeOf(b.closedAt || b.createdAt || b.closesAt) - timeOf(a.closedAt || a.createdAt || a.closesAt),
  );
  return { open, closed };
};

export const adminCircles = (circles: VoteCircle[]) => circles.filter((circle) => circle.isAdmin === true);

export const canCreateVote = (input: { isChurchAdmin: boolean; circles: VoteCircle[] }) =>
  input.isChurchAdmin || adminCircles(input.circles).length > 0;

/** First circle the person admins, once, until they change it. Whole church stays off. */
export const initialAdminCircleIds = (
  circles: VoteCircle[],
  untouched: boolean,
  current: Array<number | string>,
) => {
  if (!untouched || current.length > 0) return current;
  const admin = adminCircles(circles)[0];
  return admin ? [admin.id] : current;
};

export const selectedAudienceLabel = (
  circles: VoteCircle[],
  selectedIds: Array<number | string>,
  wholeChurch: boolean,
) => {
  if (wholeChurch) return VOTING_COPY.wholeChurch;
  const selected = adminCircles(circles).filter((circle) =>
    selectedIds.some((id) => String(id) === String(circle.id)),
  );
  if (selected.length === 0) return VOTING_COPY.chooseWho;
  if (selected.length === 1) return selected[0].name;
  return `${selected[0].name} + ${selected.length - 1}`;
};

export const addOption = (options: string[]) => (options.length >= OPTION_MAX ? options : [...options, '']);

export const removeOption = (options: string[], index: number) => {
  if (options.length <= OPTION_MIN) return options;
  return options.filter((_, item) => item !== index);
};

export const setOption = (options: string[], index: number, value: string) =>
  options.map((option, item) => (item === index ? value : option));

export const castPayload = (optionId: number | string) => ({ choice_id: coerceId(optionId) });

/**
 * Post vote is allowed when the title, at least two distinct choices, an audience,
 * and a future close time are present. The rubric is guidance and is not checked.
 */
export const buildVoteCreate = (input: VoteCreateInput): VoteCreateResult => {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) return { ok: false, field: 'title', message: VOTING_COPY.titleRequired };
  if (title.length > TITLE_MAX) {
    return { ok: false, field: 'title', message: `Title must be ${TITLE_MAX} characters or fewer.` };
  }
  if (description.length > DESCRIPTION_MAX) {
    return {
      ok: false,
      field: 'description',
      message: `Description must be ${DESCRIPTION_MAX} characters or fewer.`,
    };
  }
  const options = input.options.map((option) => option.trim()).filter(Boolean);
  if (options.length < OPTION_MIN) {
    return { ok: false, field: 'options', message: VOTING_COPY.optionsRequired };
  }
  if (options.length > OPTION_MAX) {
    return { ok: false, field: 'options', message: `Use ${OPTION_MAX} choices or fewer.` };
  }
  const distinct = new Set(options.map((option) => option.toLocaleLowerCase()));
  if (distinct.size !== options.length) {
    return { ok: false, field: 'options', message: VOTING_COPY.optionsDistinct };
  }
  if (input.wholeChurch && !input.isChurchAdmin) {
    return { ok: false, field: 'audience', message: VOTING_COPY.churchAdminRequired };
  }
  if (!input.wholeChurch && input.circleIds.length === 0) {
    return { ok: false, field: 'audience', message: VOTING_COPY.audienceRequired };
  }
  const closesAt = input.closesAt.trim();
  const closes = new Date(closesAt);
  if (!closesAt || Number.isNaN(closes.getTime())) {
    return { ok: false, field: 'closes', message: VOTING_COPY.closesRequired };
  }
  const now = input.now ?? new Date();
  if (closes.getTime() <= now.getTime()) {
    return { ok: false, field: 'closes', message: VOTING_COPY.closesFuture };
  }
  return {
    ok: true,
    payload: {
      title,
      description,
      choices: options,
      whole_church: input.wholeChurch === true,
      circle_ids: input.wholeChurch ? [] : input.circleIds.map(coerceId),
      closes_at: closes.toISOString(),
      results_mode: input.resultsMode === 'live' ? 'live' : 'after_close',
    },
  };
};

export const normalizeVoteCircles = (value: unknown): VoteCircle[] => {
  const record = asRecord(value);
  const raw = Array.isArray(value) ? value : record.circles ?? record.results ?? [];
  if (!Array.isArray(raw)) return [];
  const circles: VoteCircle[] = [];
  for (const item of raw) {
    if (typeof item === 'string' || typeof item === 'number') {
      const id = asId(item);
      if (id != null) circles.push({ id, name: String(item) });
      continue;
    }
    const row = asRecord(item);
    const id = asId(row.id);
    if (id == null) continue;
    const membership = row.is_member ?? row.isMember;
    circles.push({
      id,
      name: asString(row.name) || String(id),
      isMember: membership == null ? undefined : asBool(membership),
      isAdmin: asBool(row.is_admin ?? row.isAdmin),
    });
  }
  return circles;
};

const normalizeOptions = (value: unknown): VoteOption[] => {
  if (!Array.isArray(value)) return [];
  const options: Array<VoteOption & { position: number | null; index: number }> = [];
  value.forEach((item, index) => {
    if (typeof item === 'string') {
      const label = item.trim();
      if (label) options.push({ id: index, label, count: null, position: null, index });
      return;
    }
    const row = asRecord(item);
    const label = asString(row.label ?? row.text ?? row.title ?? row.name).trim();
    const id = asId(row.id) ?? index;
    if (!label) return;
    const countRaw = firstDefined(row.vote_count, row.voteCount, row.count, row.tally, row.ballot_count);
    const position = typeof row.position === 'number' && Number.isFinite(row.position) ? row.position : null;
    options.push({
      id,
      label,
      count: asCount(countRaw),
      position,
      index,
    });
  });
  options.sort((a, b) => {
    if (a.position == null && b.position == null) return a.index - b.index;
    if (a.position == null) return 1;
    if (b.position == null) return -1;
    return a.position - b.position || a.index - b.index;
  });
  return options.map(({ id, label, count }) => ({ id, label, count }));
};

const normalizeStatus = (value: unknown): Vote['status'] => {
  if (value === 'closed' || value === 'close') return 'closed';
  if (value === 'open') return 'open';
  return null;
};

const normalizeResultsMode = (value: unknown): ResultsMode => {
  const mode = asString(value).toLowerCase();
  if (mode === 'live' || mode === 'live_while_open') return 'live';
  return 'after_close';
};

export const normalizeVote = (value: unknown): Vote | null => {
  const raw = asRecord(value);
  const id = asId(raw.id);
  const title = asString(raw.title).trim();
  if (id == null || !title) return null;
  const ballot = asRecord(raw.ballot ?? raw.my_ballot ?? raw.myBallot);
  const myOptionId = asId(
    firstDefined(raw.my_choice_id, raw.myChoiceId, raw.my_option_id, raw.myOptionId, ballot.option_id, ballot.optionId),
  );
  const audienceRaw = asString(raw.audience).toLowerCase();
  const wholeChurch = asBool(raw.whole_church ?? raw.wholeChurch) || audienceRaw === 'church';
  const closedAt = asString(raw.closed_at ?? raw.closedAt) || null;
  const isOpen = asFlag(firstDefined(raw.is_open, raw.isOpen));
  const totalRaw = firstDefined(raw.total_votes, raw.totalVotes);
  return {
    id,
    title,
    description: asString(raw.description ?? raw.details ?? raw.body),
    closesAt: asString(raw.closes_at ?? raw.closesAt),
    closedAt,
    resultsMode: normalizeResultsMode(raw.results_mode ?? raw.resultsMode),
    audience: wholeChurch ? 'church' : 'circles',
    circles: normalizeVoteCircles(raw.circles ?? raw.circle_ids ?? raw.circleIds),
    churchName: asString(
      raw.church_name ?? raw.churchName ?? asRecord(raw.church).name ?? (wholeChurch ? raw.visibility_summary : ''),
    ),
    options: normalizeOptions(firstDefined(raw.choices, raw.options)),
    myOptionId,
    hasVoted: asBool(raw.has_voted ?? raw.hasVoted) || myOptionId != null,
    canClose: asBool(raw.can_close ?? raw.canClose ?? raw.can_manage ?? raw.canManage),
    totalVotes: totalRaw === undefined ? undefined : asCount(totalRaw),
    resultsVisible: asFlag(firstDefined(raw.results_visible, raw.resultsVisible)),
    canVote: asFlag(firstDefined(raw.can_vote, raw.canVote)),
    status: closedAt || isOpen === false ? 'closed' : isOpen === true ? 'open' : normalizeStatus(raw.status),
    createdAt: asString(raw.created_at ?? raw.createdAt),
  };
};

export const normalizeVoteList = (value: unknown): Vote[] => {
  const record = asRecord(value);
  const take = (rows: unknown, bucket: 'open' | 'closed' | null) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        const vote = normalizeVote(item);
        if (!vote) return null;
        if (bucket === 'closed') return { ...vote, status: 'closed' as const };
        return vote;
      })
      .filter((item): item is Vote => item != null);
  };
  if (Array.isArray(record.open) || Array.isArray(record.closed)) {
    return [...take(record.open, 'open'), ...take(record.closed, 'closed')];
  }
  const raw = Array.isArray(value) ? value : record.results ?? record.votes ?? record.items ?? [];
  return take(raw, null);
};
