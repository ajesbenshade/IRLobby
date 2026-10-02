import { APPROVAL_COPY, SWIPE_COPY } from '@constants/foyerCopy';
import { isRequireApprovalEnabled } from '@foyer/capabilities';
import { hasEventStarted } from '@foyer/rsvp';

export type RequestStatus = 'none' | 'pending' | 'approved' | 'declined';

export const MAX_DECLINE_NOTE = 280;

export type ApprovalActivity = {
  requires_approval?: boolean | null;
  allow_rerequest?: boolean | null;
  my_request_status?: string | null;
  my_request_reason?: string | null;
  pending_count?: number | null;
  is_cancelled?: boolean | null;
  time?: string | null;
  end_time?: string | null;
  max_participants?: number | null;
  participants_count?: number | null;
};

/** Gated: requires a backend that sends `my_request_status` / `allow_rerequest` (or the FEATURES switch). */
export const isApprovalActive = (activity?: ApprovalActivity | null) => isRequireApprovalEnabled(activity as Record<string, unknown> | null | undefined);

/** True only when the feature is on AND this gathering asks for approval (legacy `requires_approval` alone never counts). */
export const gatheringRequiresApproval = (activity?: ApprovalActivity | null) =>
  isApprovalActive(activity) && activity?.requires_approval === true;

/** "Approval required" tag on Discover cards. Same gate as everything else. */
export const showApprovalRequiredTag = gatheringRequiresApproval;

export const requestStatusOf = (activity?: ApprovalActivity | null): RequestStatus => {
  if (!isApprovalActive(activity)) {
    return 'none';
  }
  const raw = String(activity?.my_request_status ?? 'none').toLowerCase();
  return raw === 'pending' || raw === 'approved' || raw === 'declined' ? raw : 'none';
};

export type JoinButton = {
  kind: 'request' | 'sent' | 'closed' | 'askAgain' | 'join';
  label: string;
  disabled: boolean;
  filled: boolean;
};

/**
 * Guest action label for a gathering. `join` means the normal RSVP flow.
 *   not asked yet    -> Request to join (filled)
 *   pending          -> Request sent    (disabled)
 *   declined         -> Ask again (filled) when allow_rerequest, else Request closed (disabled)
 *   approved         -> normal going state
 */
export const joinButtonFor = (activity: ApprovalActivity | null | undefined, joinLabel: string): JoinButton => {
  if (!gatheringRequiresApproval(activity) && requestStatusOf(activity) === 'none') {
    return { kind: 'join', label: joinLabel, disabled: false, filled: true };
  }
  switch (requestStatusOf(activity)) {
    case 'pending':
      return { kind: 'sent', label: APPROVAL_COPY.requestSent, disabled: true, filled: false };
    case 'declined':
      return activity?.allow_rerequest
        ? { kind: 'askAgain', label: APPROVAL_COPY.askAgain, disabled: false, filled: true }
        : { kind: 'closed', label: APPROVAL_COPY.requestClosed, disabled: true, filled: false };
    case 'approved':
      return { kind: 'join', label: joinLabel, disabled: false, filled: true };
    default:
      return { kind: 'request', label: APPROVAL_COPY.requestToJoin, disabled: false, filled: true };
  }
};

export type DiscoverGoingKind = 'join' | 'request' | 'askAgain' | 'sent' | 'closed' | 'full' | 'cancelled';

/**
 * The primary Discover button for one card: the approval state, with Full and Cancelled taking over.
 * `join` and `request` are filled burgundy with white text, `askAgain` is a burgundy outline on white, `sent` is the soft rose disabled pill
 * and `closed`, `full`, `cancelled` are the grey disabled pill.
 */
export const discoverGoingButton = (input: {
  join: JoinButton;
  full: boolean;
  cancelled: boolean;
}): { kind: DiscoverGoingKind; label: string | undefined; disabled: boolean } => {
  if (input.cancelled) {
    return { kind: 'cancelled', label: SWIPE_COPY.cancelled, disabled: true };
  }
  if (input.full) {
    return { kind: 'full', label: SWIPE_COPY.full, disabled: true };
  }
  const kind = input.join.kind;
  return {
    kind,
    // The plain I'm going state keeps the component's default label.
    label:
      kind === 'join'
        ? undefined
        : kind === 'closed'
          ? SWIPE_COPY.closed
          : input.join.label,
    disabled: input.join.disabled,
  };
};

/** A request that is still pending when the event starts is closed (no auto-decline, no push). */
export const isRequestClosedByStart = (activity: ApprovalActivity | null | undefined, now?: Date) => {
  if (!activity) {
    return false;
  }
  const ended = activity.end_time ? new Date(activity.end_time).getTime() <= (now ?? new Date()).getTime() : false;
  return hasEventStarted(activity.time, now) || ended;
};

/** Guest-side detail state. */
export type GuestRequestView = 'pending' | 'pendingClosed' | 'declined' | 'declinedClosed' | 'approved' | 'none';

export const guestRequestView = (activity: ApprovalActivity | null | undefined, now?: Date): GuestRequestView => {
  const status = requestStatusOf(activity);
  const closed = isRequestClosedByStart(activity, now);
  if (status === 'pending') {
    return closed ? 'pendingClosed' : 'pending';
  }
  if (status === 'declined') {
    return closed ? 'declinedClosed' : 'declined';
  }
  return status === 'approved' ? 'approved' : 'none';
};

/** Pending and declined guests see no address, chat or guest list. */
export const guestSeesPrivateDetails = (activity: ApprovalActivity | null | undefined) => {
  const status = requestStatusOf(activity);
  return status !== 'pending' && status !== 'declined';
};

// ---- Host side ----

export type RequestMember = { name: string; relationship?: string | null; age_band?: string | null };

export type JoinRequest = {
  id: number;
  user_id: number;
  requested_at?: string | null;
  decided_at?: string | null;
  /** The host's decline note (max 280), present on declined items of the host's list. */
  decline_reason?: string | null;
  status: 'pending' | 'approved' | 'declined' | string;
  party: { size: number; include_self?: boolean; members?: RequestMember[] };
  card: {
    first_name: string;
    age_band?: string | null;
    /** null for minors */
    avatar_url?: string | null;
    /** null for minors */
    bio?: string | null;
    church_name?: string | null;
  };
};

export type RequestsResponse = {
  pending_count: number;
  /** null when the gathering has no limit */
  spots_left: number | null;
  requests: JoinRequest[];
};

export type DecisionResponse = {
  request: JoinRequest;
  going_count: number;
  spots_left: number | null;
};

/** Minors share first name + age band only: no photo, no bio. */
export const isMinorCard = (request: JoinRequest): boolean =>
  !request.card.avatar_url && !request.card.bio && Boolean(request.card.age_band) && /^(1[0-7]|teen|minor|under)/i.test(String(request.card.age_band));

export const cardInitials = (firstName: string) => (firstName.trim()[0] ?? '?').toUpperCase();

export const partyLine = (request: JoinRequest) => APPROVAL_COPY.partyOf(request.party.size, request.card.first_name);

/** Hosts see an age-band chip only (Adult / 13–17 / Under 13). No relationship wording (Spouse, Child, ...) anywhere. */
export const memberRowLabel = (member: RequestMember): string => (member.age_band ? APPROVAL_COPY.ageBand(member.age_band) : '');

/** Does this request still fit? Unlimited (`null`) always fits. */
export const partyFits = (request: JoinRequest, spotsLeft: number | null) =>
  spotsLeft == null || request.party.size <= spotsLeft;

/** Server-trusted rule: pending in -> approved/declined out; approved can't be declined; declined may be approved later. */
export const canApprove = (request: JoinRequest) => request.status === 'pending' || request.status === 'declined';
export const canDecline = (request: JoinRequest) => request.status === 'pending';

export const clampDeclineNote = (value: string) => value.slice(0, MAX_DECLINE_NOTE);

/** Decline body: `reason` only when non-empty. Goes in the push and, for the declined requester, `my_request_reason`. */
export const declineBody = (note: string): { reason?: string } => {
  const trimmed = clampDeclineNote(note).trim();
  return trimmed ? { reason: trimmed } : {};
};

const statusOf = (error: unknown): number | undefined => (error as { response?: { status?: number } })?.response?.status;
const detailOf = (error: unknown): string | null => {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' && detail.trim() ? detail.trim() : null;
};

export type DecisionFailure =
  | { kind: 'noFit'; message: string }
  | { kind: 'closed'; message: string }
  | { kind: 'gone'; message: string }
  | { kind: 'generic'; message: string };

/** 409 -> inline "doesn't fit"; 400 -> requests closed (cancelled/started/ended); 403/404 -> gone. */
export const describeDecisionError = (error: unknown): DecisionFailure => {
  const status = statusOf(error);
  const detail = detailOf(error);
  if (status === 409) {
    return { kind: 'noFit', message: detail ?? APPROVAL_COPY.noFit };
  }
  if (status === 400) {
    return { kind: 'closed', message: detail ?? APPROVAL_COPY.deckClosedBody };
  }
  if (status === 403 || status === 404) {
    return { kind: 'gone', message: detail ?? APPROVAL_COPY.decideError };
  }
  return { kind: 'generic', message: APPROVAL_COPY.decideError };
};

/** Turn-off guard on the host form: block (and send to the deck) while requests are waiting. */
export const turnOffBlockedCount = (activity: ApprovalActivity | null | undefined): number =>
  Math.max(0, Number(activity?.pending_count ?? 0));

/** Server fallback `Review your requests first. You still have N waiting.` (400 on update). */
export const parseTurnOffFallback = (message: string | null | undefined): number | null => {
  const match = /review your requests first.*?(\d+)\s+waiting/i.exec(message ?? '');
  return match ? Number(match[1]) : null;
};

/** Gatherings-list tag for the viewer's own request. */
export const requestTagFor = (activity: ApprovalActivity | null | undefined): 'pending' | 'declined' | 'approved' | null => {
  const status = requestStatusOf(activity);
  return status === 'pending' || status === 'declined' || status === 'approved' ? status : null;
};

/**
 * The host's decline note for the declined requester. Gated on the field: absent, empty or
 * whitespace-only shows nothing extra, and it only ever shows for a declined request.
 */
export const declineNoteFor = (activity: ApprovalActivity | null | undefined): string | null => {
  if (requestStatusOf(activity) !== 'declined') {
    return null;
  }
  const note = typeof activity?.my_request_reason === 'string' ? activity.my_request_reason.trim() : '';
  return note || null;
};
