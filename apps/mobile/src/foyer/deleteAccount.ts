import { DELETE_ACCOUNT_COPY } from '@constants/foyerCopy';
import { isActivityCancelled } from '@foyer/cancel';
import { hasEventStarted } from '@foyer/rsvp';

/** `Delete my account` unlocks only when the exact word is typed (spec: case as shown). */
export const isDeleteWordTyped = (value: string): boolean => value.trim() === DELETE_ACCOUNT_COPY.typeWord;

/** Upcoming, not-cancelled gatherings the person hosts: they are cancelled by the server when the account goes. */
export const upcomingHostedCount = (
  rows: ReadonlyArray<{ time?: string | null; is_cancelled?: boolean | null; status?: string | null }> | null | undefined,
  now?: Date,
): number => (rows ?? []).filter((row) => !isActivityCancelled(row) && !hasEventStarted(row.time, now)).length;
