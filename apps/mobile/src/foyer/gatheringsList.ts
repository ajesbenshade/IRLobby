import { isActivityCancelled, sortCancelledLast, type CancelableActivity } from '@foyer/cancel';
import { isRequestClosedByStart, requestStatusOf, type ApprovalActivity } from '@foyer/approval';
import { isGoingRsvp } from '@foyer/rsvp';

type ListRow = CancelableActivity &
  ApprovalActivity & { my_rsvp?: { status?: string; people_count?: number } | null };

export type RowTag = 'cancelled' | 'pending' | 'declined' | 'closed' | 'approved';

/**
 * Tag shown under the date on a Your gatherings row.
 *  - cancelled by the host: `Cancelled` (wins over everything)
 *  - request still pending after the event started: `Closed` (muted)
 *  - pending / declined / approved request: the matching tag
 */
export const rowTag = (row: ListRow, now?: Date): RowTag | null => {
  if (isActivityCancelled(row)) {
    return 'cancelled';
  }
  const status = requestStatusOf(row);
  if (status === 'pending') {
    return isRequestClosedByStart(row, now) ? 'closed' : 'pending';
  }
  if (status === 'declined') {
    return 'declined';
  }
  if (status === 'approved') {
    return 'approved';
  }
  return null;
};

/**
 * REQUESTS group = pending / declined / closed requests (nothing is reserved for them yet).
 * GOING group = confirmed guests, including approved. Cancelled rows sort below active rows in each group.
 */
export const splitGoingRows = <T extends ListRow>(rows: readonly T[]) => {
  const requests: T[] = [];
  const going: T[] = [];
  for (const row of rows) {
    const status = requestStatusOf(row);
    const rawStatus = String(row.my_rsvp?.status ?? '').toLowerCase();
    const isRequestRow = status === 'pending' || status === 'declined' || rawStatus === 'pending' || rawStatus === 'declined';
    if (isRequestRow && !isGoingRsvp(row.my_rsvp) && status !== 'approved') {
      requests.push(row);
    } else {
      going.push(row);
    }
  }
  return { requests: sortCancelledLast(requests), going: sortCancelledLast(going) };
};

/** Pending, declined and closed requests never get a Chat button; the host and going guests do. */
export const rowShowsChat = (row: ListRow, now?: Date): boolean => {
  const tag = rowTag(row, now);
  return tag !== 'pending' && tag !== 'declined' && tag !== 'closed';
};
