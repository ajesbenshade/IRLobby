/**
 * Circles join policy A. Church-scoped. Open join is closed: clients use
 * join requests and invites. `is_member` is true only for `membership_state` `joined`.
 *
 *   GET    /api/circles/?q=
 *   POST   /api/circles/
 *   GET    /api/circles/<id>/
 *   POST   /api/circles/<id>/join-requests/
 *   GET    /api/circles/<id>/join-requests/
 *   POST   /api/circles/<id>/join-requests/<request_id>/approve/
 *   POST   /api/circles/<id>/join-requests/<request_id>/decline/
 *   POST   /api/circles/<id>/invites/
 *   GET    /api/circles/<id>/invites/
 *   GET    /api/circles/invites/
 *   POST   /api/circles/invites/<invite_id>/accept/
 *   POST   /api/circles/invites/<invite_id>/decline/
 *   GET    /api/circles/<id>/members/
 *   POST   /api/circles/<id>/members/<user_id>/remove/
 *   POST   /api/circles/<id>/members/<user_id>/make-admin/
 *   POST   /api/circles/<id>/members/<user_id>/remove-admin/
 *   POST   /api/circles/<id>/leave/
 *   GET    /api/circles/<id>/people/?q=
 *   POST   /api/circles/<id>/report/
 */

export const CIRCLE_NAME_MAX = 80;
export const CIRCLE_DESCRIPTION_MAX = 280;
export const CIRCLE_INVITE_BATCH_MAX = 50;

export const LAST_ADMIN_CODE = 'last_admin';

export type MembershipState = 'none' | 'pending' | 'joined' | 'invited';

export type CircleReportReason =
  | 'inappropriate'
  | 'spam'
  | 'harassment'
  | 'fake_profile'
  | 'threat'
  | 'other';

export const CIRCLE_REPORT_REASONS: Array<{ value: CircleReportReason; label: string }> = [
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'fake_profile', label: 'Fake profile' },
  { value: 'threat', label: 'Threat or violence' },
  { value: 'other', label: 'Other' },
];

export const CIRCLE_COPY = {
  createTitle: 'Create a circle',
  nameLabel: 'Name',
  namePlaceholder: 'e.g. Upper Fellowship Hall Sunday school',
  descriptionLabel: 'Description (optional)',
  createCta: 'Create circle',
  nameRequired: 'Add a name for this circle.',
  directoryTitle: 'Circles',
  searchPlaceholder: 'Search circles',
  requestCta: 'Request to join',
  pending: 'Request sent',
  alreadyInvited: 'You already have an invite to this circle. Accept it to join.',
  inCircle: 'You are in',
  inviteCta: 'Invite people',
  sendInvites: 'Send invites',
  accept: 'Accept',
  decline: 'Decline',
  approve: 'Approve',
  manage: 'Manage circle',
  leave: 'Leave circle',
  removeMember: 'Remove from circle',
  makeAdmin: 'Make admin',
  removeAdmin: 'Remove admin',
  lastAdmin: 'Circles need at least one admin.',
  report: 'Report circle',
  emptyDirectory: 'No circles yet. Create one for your group.',
  noMatch: 'No circles match.',
  noRequests: 'No join requests.',
  requests: 'Requests',
  members: 'Members',
  admins: 'Admins',
  skip: 'Skip',
  cancel: 'Cancel',
  back: 'Circles',
  peopleSearch: 'Search people',
  noPeople: 'No one to invite.',
  invited: 'Invited',
  reportSent: 'Thanks. We got your report.',
  loadFailed: "Couldn't load circles. Pull to try again.",
  saveFailed: "Couldn't update this circle. Please try again.",
  requestFailed: "Couldn't send that request. Please try again.",
  sendFailed: "Couldn't send those invites. Please try again.",
  reportFailed: "Couldn't send that report. Please try again.",
} as const;

export type CircleSummary = {
  id: number | string;
  name: string;
  description: string;
  churchId: number | string | null;
  memberCount: number;
  isMember: boolean;
  isAdmin: boolean;
  /** Missing only when the payload is not a directory row (a prayer audience chip). */
  membershipState?: MembershipState;
};

export type CirclePerson = {
  id: number | string;
  firstName: string;
  lastInitial: string;
  name: string;
  isAdmin: boolean;
  joinedAt: string;
  inviteState: 'none' | 'invited';
};

export type CircleDetail = CircleSummary & {
  membersPreview: CirclePerson[];
};

export type CircleJoinRequestRow = {
  id: number | string;
  circleId: number | string;
  status: string;
  user: CirclePerson;
  createdAt: string;
};

export type CircleInviteRow = {
  id: number | string;
  circleId: number | string;
  status: string;
  invitee: CirclePerson;
  inviter: CirclePerson | null;
  createdAt: string;
  circleName: string;
  circleDescription: string;
  circleMemberCount: number;
};

export type CircleInviteError = {
  userId: number | string;
  detail: string;
};

export type CircleDetailAction = 'request' | 'pending' | 'leave' | 'invite' | 'manage' | 'accept';

export class CircleClientError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'CircleClientError';
    this.status = status;
    this.code = code;
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

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

const firstText = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstText(item);
      if (text) return text;
    }
  }
  return '';
};

const readState = (value: unknown): MembershipState | undefined => {
  if (value === 'none' || value === 'pending' || value === 'joined' || value === 'invited') return value;
  return undefined;
};

export const circlePaths = {
  list: (query = '') => {
    const q = query.trim();
    return q ? `/api/circles/?q=${encodeURIComponent(q)}` : '/api/circles/';
  },
  create: () => '/api/circles/',
  detail: (id: number | string) => `/api/circles/${id}/`,
  joinRequests: (id: number | string) => `/api/circles/${id}/join-requests/`,
  approveRequest: (id: number | string, requestId: number | string) =>
    `/api/circles/${id}/join-requests/${requestId}/approve/`,
  declineRequest: (id: number | string, requestId: number | string) =>
    `/api/circles/${id}/join-requests/${requestId}/decline/`,
  invites: (id: number | string) => `/api/circles/${id}/invites/`,
  inbox: () => '/api/circles/invites/',
  acceptInvite: (inviteId: number | string) => `/api/circles/invites/${inviteId}/accept/`,
  declineInvite: (inviteId: number | string) => `/api/circles/invites/${inviteId}/decline/`,
  members: (id: number | string) => `/api/circles/${id}/members/`,
  removeMember: (id: number | string, userId: number | string) => `/api/circles/${id}/members/${userId}/remove/`,
  makeAdmin: (id: number | string, userId: number | string) => `/api/circles/${id}/members/${userId}/make-admin/`,
  removeAdmin: (id: number | string, userId: number | string) => `/api/circles/${id}/members/${userId}/remove-admin/`,
  leave: (id: number | string) => `/api/circles/${id}/leave/`,
  people: (id: number | string, query = '') => `/api/circles/${id}/people/?q=${encodeURIComponent(query.trim())}`,
  report: (id: number | string) => `/api/circles/${id}/report/`,
};

export const sameId = (left: number | string | null | undefined, right: number | string | null | undefined) =>
  left != null && right != null && String(left) === String(right);

export const coerceId = (id: number | string): number | string => {
  if (typeof id === 'number') return id;
  return /^\d+$/.test(id) ? Number(id) : id;
};

/** Joined members only. Pending and invited are not in the prayer picker. */
export const isJoinedCircle = (circle: { membershipState?: MembershipState; isMember?: boolean }) => {
  if (circle.membershipState === 'joined') return true;
  if (circle.membershipState === 'none' || circle.membershipState === 'pending' || circle.membershipState === 'invited') {
    return false;
  }
  return circle.isMember !== false;
};

export const pickerCircles = <T extends { membershipState?: MembershipState; isMember?: boolean }>(circles: T[]) =>
  circles.filter((circle) => isJoinedCircle(circle));

export const memberCountLabel = (count: number) => {
  const n = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  return n === 1 ? '1 member' : `${n} members`;
};

export const directoryChip = (circle: { membershipState?: MembershipState; isMember?: boolean }) => {
  if (circle.membershipState === 'joined' || (circle.membershipState == null && circle.isMember === true)) {
    return CIRCLE_COPY.inCircle;
  }
  if (circle.membershipState === 'pending') return CIRCLE_COPY.pending;
  return null;
};

export const directoryEmptyCopy = (query: string, count: number) => {
  if (count > 0) return null;
  return query.trim() ? CIRCLE_COPY.noMatch : CIRCLE_COPY.emptyDirectory;
};

export const inviteLine = (inviterName: string, circleName: string) =>
  `${inviterName.trim() || 'Someone'} invited you to ${circleName.trim() || 'a circle'}`;

export const leaveConfirmCopy = (circleName: string) =>
  `Leave ${circleName.trim() || 'this circle'}? You can request to join again later.`;

export const circleDetailActions = (circle: {
  membershipState?: MembershipState;
  isAdmin?: boolean;
  isMember?: boolean;
}): CircleDetailAction[] => {
  const state = circle.membershipState ?? (circle.isMember ? 'joined' : 'none');
  if (state === 'joined' && circle.isAdmin) return ['invite', 'manage'];
  if (state === 'joined') return ['leave'];
  if (state === 'pending') return ['pending'];
  if (state === 'invited') return ['accept'];
  return ['request'];
};

export const isLastAdmin = (members: Array<{ id: number | string; isAdmin?: boolean }>, personId: number | string) => {
  const admins = members.filter((member) => member.isAdmin);
  return admins.length <= 1 && admins.some((member) => sameId(member.id, personId));
};

export const buildCircleCreate = (
  input: { name: string; description: string },
): { ok: true; payload: { name: string; description: string } } | { ok: false; message: string } => {
  const name = input.name.trim();
  const description = input.description.trim();
  if (!name) return { ok: false, message: CIRCLE_COPY.nameRequired };
  if (name.length > CIRCLE_NAME_MAX) {
    return { ok: false, message: `Name must be ${CIRCLE_NAME_MAX} characters or fewer.` };
  }
  if (description.length > CIRCLE_DESCRIPTION_MAX) {
    return { ok: false, message: `Description must be ${CIRCLE_DESCRIPTION_MAX} characters or fewer.` };
  }
  return { ok: true, payload: { name, description } };
};

export const circleFailureMessage = (body: unknown, fallback: string): { message: string; code?: string } => {
  const record = asRecord(body);
  const code = asString(record.code).trim() || undefined;
  if (code === LAST_ADMIN_CODE) return { message: CIRCLE_COPY.lastAdmin, code };
  const preferred = ['detail', 'name', 'description', 'user_ids', 'church', 'error', 'non_field_errors'];
  for (const key of preferred) {
    const text = firstText(record[key]);
    if (text) return { message: text, code };
  }
  if (Array.isArray(record.errors)) {
    const texts = record.errors.map((item) => firstText(asRecord(item).detail)).filter(Boolean);
    if (texts.length > 0) return { message: texts.join(' '), code };
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === 'code') continue;
    const text = firstText(value);
    if (text) return { message: text, code };
  }
  return { message: fallback, code };
};

const personName = (row: Record<string, unknown>) => {
  const explicit = asString(row.display_name ?? row.displayName ?? row.name).trim();
  if (explicit) return explicit;
  const first = asString(row.first_name ?? row.firstName).trim();
  const initial = asString(row.last_initial ?? row.lastInitial).trim();
  if (first && initial) return `${first} ${initial.replace(/\.$/, '')}.`;
  return first || 'Member';
};

export const normalizePerson = (value: unknown): CirclePerson | null => {
  const row = asRecord(value);
  const id = asId(row.id);
  if (id == null) return null;
  const invite = row.invite_state ?? row.inviteState;
  return {
    id,
    firstName: asString(row.first_name ?? row.firstName),
    lastInitial: asString(row.last_initial ?? row.lastInitial),
    name: personName(row),
    isAdmin: asBool(row.is_admin ?? row.isAdmin),
    joinedAt: asString(row.joined_at ?? row.joinedAt),
    inviteState: invite === 'invited' ? 'invited' : 'none',
  };
};

export const normalizePeople = (value: unknown): CirclePerson[] => {
  const record = asRecord(value);
  const raw = Array.isArray(value) ? value : record.people ?? record.members ?? record.members_preview ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePerson).filter((person): person is CirclePerson => person != null);
};

const summarize = (row: Record<string, unknown>): CircleSummary | null => {
  const id = asId(row.id);
  if (id == null) return null;
  const explicit = readState(row.membership_state ?? row.membershipState);
  const flag = row.is_member ?? row.isMember;
  let membershipState = explicit;
  let isMember: boolean;
  if (membershipState) {
    isMember = membershipState === 'joined';
  } else if (flag == null) {
    isMember = true;
  } else {
    isMember = asBool(flag);
    membershipState = isMember ? 'joined' : 'none';
  }
  return {
    id,
    name: asString(row.name).trim() || String(id),
    description: asString(row.description),
    churchId: asId(row.church_id ?? row.churchId),
    memberCount: asCount(row.member_count ?? row.memberCount),
    isMember,
    isAdmin: asBool(row.is_admin ?? row.isAdmin),
    membershipState,
  };
};

export const normalizeCircleSummaries = (value: unknown): CircleSummary[] => {
  const record = asRecord(value);
  const raw = Array.isArray(value) ? value : record.circles ?? record.results;
  if (!Array.isArray(raw)) {
    const one = summarize(record);
    return one ? [one] : [];
  }
  const circles: CircleSummary[] = [];
  for (const item of raw) {
    if (typeof item === 'string' || typeof item === 'number') {
      const id = asId(item);
      if (id != null) {
        circles.push({
          id,
          name: String(item),
          description: '',
          churchId: null,
          memberCount: 0,
          isMember: true,
          isAdmin: false,
        });
      }
      continue;
    }
    const summary = summarize(asRecord(item));
    if (summary) circles.push(summary);
  }
  return circles;
};

export const normalizeCircleDetail = (value: unknown): CircleDetail | null => {
  const record = asRecord(value);
  const summary = summarize(record);
  if (!summary) return null;
  return {
    ...summary,
    membersPreview: normalizePeople(record.members_preview ?? record.membersPreview ?? []),
  };
};

export const normalizeJoinRequests = (value: unknown): CircleJoinRequestRow[] => {
  const record = asRecord(value);
  const raw = Array.isArray(value) ? value : record.requests ?? [];
  if (!Array.isArray(raw)) return [];
  const rows: CircleJoinRequestRow[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    const id = asId(row.id);
    const user = normalizePerson(row.user);
    if (id == null || !user) continue;
    rows.push({
      id,
      circleId: asId(row.circle_id ?? row.circleId) ?? 0,
      status: asString(row.status) || 'pending',
      user,
      createdAt: asString(row.created_at ?? row.createdAt),
    });
  }
  return rows;
};

const normalizeInvite = (value: unknown): CircleInviteRow | null => {
  const row = asRecord(value);
  const id = asId(row.id);
  const invitee = normalizePerson(row.invitee);
  if (id == null || !invitee) return null;
  const circle = asRecord(row.circle);
  return {
    id,
    circleId: asId(row.circle_id ?? row.circleId ?? circle.id) ?? 0,
    status: asString(row.status) || 'pending',
    invitee,
    inviter: normalizePerson(row.inviter),
    createdAt: asString(row.created_at ?? row.createdAt),
    circleName: asString(circle.name),
    circleDescription: asString(circle.description),
    circleMemberCount: asCount(circle.member_count ?? circle.memberCount),
  };
};

export const normalizeInvites = (value: unknown): { invites: CircleInviteRow[]; errors: CircleInviteError[] } => {
  const record = asRecord(value);
  const raw = Array.isArray(value) ? value : record.invites ?? [];
  const invites = Array.isArray(raw)
    ? raw.map(normalizeInvite).filter((invite): invite is CircleInviteRow => invite != null)
    : [];
  const errors: CircleInviteError[] = [];
  const rawErrors = record.errors;
  if (Array.isArray(rawErrors)) {
    for (const item of rawErrors) {
      const row = asRecord(item);
      const userId = asId(row.user_id ?? row.userId);
      const detail = firstText(row.detail);
      if (userId == null || !detail) continue;
      errors.push({ userId, detail });
    }
  }
  return { invites, errors };
};
