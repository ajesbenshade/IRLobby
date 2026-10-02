import { CANCEL_COPY } from '@constants/foyerCopy';
import { isHostCancelEnabled } from '@foyer/capabilities';
import { hasEventStarted } from '@foyer/rsvp';
import { MONTH_SHORT } from '@foyer/dates';

export const MAX_CANCEL_REASON = 280;
/** The counter turns the destructive colour at this many characters. */
export const CANCEL_REASON_WARN_AT = 260;

export type CancelableActivity = {
  is_cancelled?: boolean | null;
  status?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  time?: string | null;
  end_time?: string | null;
};

/** Rendered as cancelled wherever the payload says so (harmless when the fields are absent). */
export const isActivityCancelled = (activity: CancelableActivity | null | undefined): boolean =>
  Boolean(activity && (activity.is_cancelled === true || activity.status === 'cancelled'));

/** Trim, and stop typing at 280 characters (spec rule 5). */
export const clampReason = (value: string) => value.slice(0, MAX_CANCEL_REASON);

/** Body for POST cancel-event: `reason` only when there is something after trimming. */
export const cancelEventBody = (reason: string): { reason?: string } => {
  const trimmed = clampReason(reason).trim();
  return trimmed ? { reason: trimmed } : {};
};

export type HostCancelState =
  | { kind: 'hidden' }
  | { kind: 'button'; helper: string }
  | { kind: 'started'; helper: string };

/**
 * What the host sees at the bottom of their gathering.
 *  - guests, unsupported backend, cancelled events: nothing
 *  - after the start time: no button, helper `This gathering has already started.`
 *  - otherwise: the button with `Everyone who RSVPed will be notified.`
 */
export const hostCancelState = (input: {
  isHost: boolean;
  /** Staff / church admins of a church-hosted gathering see the same host controls. */
  isChurchAdminOfChurchEvent?: boolean;
  activity: CancelableActivity | null | undefined;
  now?: Date;
}): HostCancelState => {
  const { activity } = input;
  if (!activity || !(input.isHost || input.isChurchAdminOfChurchEvent)) {
    return { kind: 'hidden' };
  }
  if (!isHostCancelEnabled(activity as Record<string, unknown>) || isActivityCancelled(activity)) {
    return { kind: 'hidden' };
  }
  const now = input.now ?? new Date();
  const ended = activity.end_time ? new Date(activity.end_time).getTime() <= now.getTime() : false;
  if (hasEventStarted(activity.time, now) || ended) {
    return { kind: 'started', helper: CANCEL_COPY.helperStarted };
  }
  return { kind: 'button', helper: CANCEL_COPY.helper };
};

/** Edit stays available until the event starts, and is hidden once cancelled. */
export const canHostEdit = (input: { isHost: boolean; activity: CancelableActivity | null | undefined; now?: Date }) =>
  input.isHost && !isActivityCancelled(input.activity) && !hasEventStarted(input.activity?.time, input.now);

/** `Cancelled Oct 2` from `cancelled_at` (device time zone). Empty when unknown. */
export const cancelledDateLabel = (iso: string | null | undefined): string => {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }
  return CANCEL_COPY.bannerDate(`${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`);
};

/** `<title> was cancelled by the host.` plus ` Reason: <reason>` when the host gave one. */
export const cancelSystemMessage = (title: string, reason: string | null | undefined): string => {
  const trimmed = reason?.trim();
  return trimmed ? CANCEL_COPY.systemMessageWithReason(title, trimmed) : CANCEL_COPY.systemMessage(title);
};

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

const detailOf = (error: unknown): string | null => {
  const data = (error as { response?: { data?: { detail?: unknown; reason?: unknown } } })?.response?.data;
  for (const candidate of [data?.detail, Array.isArray(data?.reason) ? data?.reason[0] : data?.reason]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
};

export type CancelEventFailure = {
  message: string;
  /** Stale screen: close the sheet and refresh the detail (the event already started). */
  closeAndRefresh: boolean;
};

/** Maps a cancel-event failure to a toast. 400 `detail` is shown as the server wrote it. */
export const describeCancelEventError = (error: unknown): CancelEventFailure => {
  const status = statusOf(error);
  const detail = detailOf(error);
  if (status === 400 && detail) {
    return { message: detail, closeAndRefresh: /already started/i.test(detail) };
  }
  if (status === 404 || status === 405) {
    // Endpoint not deployed (404/405) or the gathering is gone.
    return { message: CANCEL_COPY.errorUnavailable, closeAndRefresh: false };
  }
  if (status === 403) {
    return { message: CANCEL_COPY.errorForbidden, closeAndRefresh: false };
  }
  return { message: CANCEL_COPY.errorGeneric, closeAndRefresh: false };
};

/**
 * Gatherings list order: within a group, cancelled rows sort below every active row,
 * otherwise the existing (date) order is kept.
 */
export const sortCancelledLast = <T extends CancelableActivity>(rows: readonly T[]): T[] => {
  const active = rows.filter((row) => !isActivityCancelled(row));
  const cancelled = rows.filter((row) => isActivityCancelled(row));
  return [...active, ...cancelled];
};

/** RSVP/request on a gathering the host already cancelled: 400 `This gathering was cancelled by the host.` */
export const isCancelledMessage = (message: string | null | undefined): boolean => /was cancelled by the host|has been cancelled/i.test(message ?? '');
