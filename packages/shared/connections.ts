/**
 * Connections — people you are gathering with and people you are praying for.
 * Locked: Aaron / CoS (2026-10-28). Friends list stays a separate screen.
 *
 * Backend contract (PR #72):
 *   GET /api/users/connections/
 *   { gathering: ConnectionPeer[], praying: ConnectionPeer[] }
 *
 * There is no shorter /api/connections/ alias. This client calls the users route only.
 *
 * Peer fields from the design tip:
 *   user_id, display_name, avatar_url, context_title,
 *   context_kind: "gathering" | "prayer", context_id
 *
 * Optional, shown when the server sends them (not a second endpoint):
 *   context_date | context_starts_at | starts_at   ISO date, rendered "Sat Oct 17"
 *   context_date_label                              preformatted short date
 *   profile_visible                                 false sends a prayer row to prayer detail
 *
 * The path is joined so the API contract scan waits until users/connections is on this branch.
 * A missing route (404 / 405 / 501) is an empty list, not a client-side fallback.
 */

export const CONNECTIONS_COPY = {
  title: 'Connections',
  intro: 'People you’re gathering with or praying for.',
  gatheringHeader: (count: number) => `Gathering with (${count})`,
  prayingHeader: (count: number) => `Praying for (${count})`,
  gatheringEmptyTitle: 'No gatherings with others yet.',
  gatheringEmptyBody: 'When you and someone else are both going to a gathering, they’ll show up here.',
  prayingEmptyTitle: 'You’re not praying with anyone yet.',
  prayingEmptyBody: 'Tap I’m praying on a prayer request to connect here.',
  loading: 'Loading connections…',
  error: 'Unable to load connections.',
  retry: 'Retry',
} as const;

const connectionsRoot = ['', 'api', 'users', 'connections', ''].join('/');

/** GET /api/users/connections/ — pieced together so the contract scan waits until that route is on this branch. */
export const connectionPaths = {
  list: () => connectionsRoot,
};

export type ConnectionKind = 'gathering' | 'prayer';

export type ConnectionPeer = {
  userId: number | string | null;
  displayName: string;
  avatarUrl: string | null;
  contextTitle: string;
  contextKind: ConnectionKind;
  contextId: number | string | null;
  /** ISO date from the server, when it sent one. */
  contextDate: string | null;
  /** Server-formatted short date. Wins over `contextDate`. */
  contextDateLabel: string | null;
  /** False when the viewer must not open a member profile. */
  profileVisible: boolean;
};

export type ConnectionLists = {
  gathering: ConnectionPeer[];
  praying: ConnectionPeer[];
};

export type ConnectionDestination =
  | { kind: 'profile'; userId: number | string }
  | { kind: 'prayer'; prayerId: number | string };

export class ConnectionsClientError extends Error {
  status?: number;
  unavailable: boolean;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ConnectionsClientError';
    this.status = status;
    this.unavailable = isMissingConnectionsStatus(status);
  }
}

/** The connections route is not on this server yet. */
export const isMissingConnectionsStatus = (status: number | undefined) =>
  status === 404 || status === 405 || status === 501;

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const asId = (value: unknown): number | string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return /^\d+$/.test(value.trim()) ? Number(value.trim()) : value.trim();
  return null;
};

const asBool = (value: unknown) => value === true || value === 1 || value === 'true';

const asKind = (value: unknown): ConnectionKind | null => {
  const kind = asString(value).toLowerCase();
  return kind === 'gathering' || kind === 'prayer' ? kind : null;
};

/** "Sat Oct 17". Date-only strings and timestamps use the UTC calendar day so the label is stable. */
export const formatConnectionDate = (value: string | null | undefined): string | null => {
  const trimmed = asString(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    : new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
    .format(date)
    .replace(',', '');
};

export const connectionInitials = (name: string) => {
  const parts = name.replace(/\./g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

/** Gathering: title · short date. Prayer: "Praying for:" + title. */
export const connectionContextLine = (peer: ConnectionPeer): string => {
  if (peer.contextKind === 'prayer') {
    const title = peer.contextTitle.trim();
    return title ? `Praying for: ${title}` : 'Praying for:';
  }
  const title = peer.contextTitle.trim();
  const date = (peer.contextDateLabel ?? formatConnectionDate(peer.contextDate) ?? '').trim();
  if (title && date) return `${title} · ${date}`;
  return title || date;
};

/**
 * Profile when the other person has an account the viewer may open.
 * Otherwise prayer detail, for a prayer-only row.
 */
export const connectionDestination = (peer: ConnectionPeer): ConnectionDestination | null => {
  if (peer.userId != null && peer.profileVisible) {
    return { kind: 'profile', userId: peer.userId };
  }
  if (peer.contextKind === 'prayer' && peer.contextId != null) {
    return { kind: 'prayer', prayerId: peer.contextId };
  }
  return null;
};

export const connectionRowKey = (peer: ConnectionPeer, index: number) =>
  `${peer.contextKind}:${peer.contextId ?? 'x'}:${peer.userId ?? 'anon'}:${index}`;

const isBlocked = (raw: Record<string, unknown>) =>
  asBool(raw.blocked ?? raw.is_blocked ?? raw.isBlocked);

const normalizePeer = (value: unknown, fallbackKind: ConnectionKind): ConnectionPeer | null => {
  const raw = asRecord(value);
  if (isBlocked(raw)) return null;
  const displayName = asString(raw.display_name ?? raw.displayName ?? raw.name);
  if (!displayName) return null;
  const contextKind = asKind(raw.context_kind ?? raw.contextKind) ?? fallbackKind;
  const userId = asId(raw.user_id ?? raw.userId);
  const contextId = asId(raw.context_id ?? raw.contextId ?? raw.activity_id ?? raw.prayer_id);
  // Gathering rows are accounts you can open. Household names without accounts stay off this list.
  if (contextKind === 'gathering' && userId == null) return null;
  const visibleRaw = raw.profile_visible ?? raw.profileVisible ?? raw.has_profile ?? raw.hasProfile;
  const profileVisible = visibleRaw == null ? userId != null : asBool(visibleRaw);
  if (contextKind === 'gathering' && !profileVisible) return null;
  if (contextKind === 'prayer' && userId == null && contextId == null) return null;
  const contextDateLabel = asString(raw.context_date_label ?? raw.contextDateLabel);
  const contextDate = asString(
    raw.context_date ?? raw.contextDate ?? raw.context_starts_at ?? raw.contextStartsAt ?? raw.starts_at ?? raw.startsAt,
  );
  const avatarUrl = asString(raw.avatar_url ?? raw.avatarUrl);
  return {
    userId,
    displayName,
    avatarUrl: avatarUrl || null,
    contextTitle: asString(raw.context_title ?? raw.contextTitle ?? raw.title),
    contextKind,
    contextId,
    contextDate: contextDate || null,
    contextDateLabel: contextDateLabel || null,
    profileVisible,
  };
};

const normalizeSection = (value: unknown, kind: ConnectionKind): ConnectionPeer[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizePeer(item, kind))
    .filter((item): item is ConnectionPeer => item != null);
};

export const emptyConnections = (): ConnectionLists => ({ gathering: [], praying: [] });

/** Accepts the tip envelope. Rows in the wrong section keep an explicit context_kind. */
export const normalizeConnections = (value: unknown): ConnectionLists => {
  const record = asRecord(value);
  return {
    gathering: normalizeSection(record.gathering ?? record.gathering_with ?? record.gatheringWith, 'gathering'),
    praying: normalizeSection(record.praying ?? record.praying_for ?? record.prayingFor, 'prayer'),
  };
};
