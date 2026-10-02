import { FULL_COPY } from '@constants/foyerCopy';
import { requestStatusOf, type ApprovalActivity } from '@foyer/approval';

type FullActivity = ApprovalActivity & { is_full?: boolean | null };

/**
 * Gated on the field: `is_full` absent or false changes nothing. The server sets it only when the
 * gathering has a cap and confirmed people fill it (pending requests never count; no cap is never full).
 */
export const isGatheringFull = (activity: FullActivity | null | undefined): boolean => activity?.is_full === true;

/**
 * Full gatherings disable the Join / RSVP / Request button for people who could still join.
 * Not for the host, someone already going, or someone with a pending / approved / declined request.
 */
export const fullBlocksJoin = (input: {
  activity: FullActivity | null | undefined;
  isHost?: boolean;
  isGoing?: boolean;
}): boolean => {
  if (!isGatheringFull(input.activity) || input.isHost || input.isGoing) {
    return false;
  }
  return requestStatusOf(input.activity) === 'none';
};

/** The notice line shown above a disabled button. */
export const fullNotice = (blocked: boolean): string | null => (blocked ? FULL_COPY.notice : null);

/** 400 `{"detail": "This gathering is full."}` from RSVP, join, swipe-right and request calls. */
export const isFullMessage = (message: string | null | undefined): boolean => /(gathering|activity) is full/i.test(message ?? '');
