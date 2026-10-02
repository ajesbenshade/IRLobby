import {
  cancelEventBody,
  clampReason,
  describeCancelEventError,
  hostCancelState,
  isActivityCancelled,
  isCancelledMessage,
  sortCancelledLast,
} from '../cancel';

const future = new Date(Date.now() + 5 * 86400000).toISOString();
const past = new Date(Date.now() - 3600000).toISOString();
const err = (status: number, data: unknown = {}) => ({ response: { status, data } });

describe('host cancel', () => {
  it('is hidden for guests, unsupported backends and cancelled gatherings', () => {
    expect(hostCancelState({ isHost: false, activity: { is_cancelled: false, time: future } }).kind).toBe('hidden');
    expect(hostCancelState({ isHost: true, activity: { time: future } }).kind).toBe('hidden'); // no is_cancelled => backend lacks it
    expect(hostCancelState({ isHost: true, activity: { is_cancelled: true, time: future } }).kind).toBe('hidden');
  });

  it('shows the button with the helper before the start and only a helper after it', () => {
    expect(hostCancelState({ isHost: true, activity: { is_cancelled: false, time: future } })).toEqual({
      kind: 'button',
      helper: 'Everyone who RSVPed will be notified.',
    });
    expect(hostCancelState({ isHost: true, activity: { is_cancelled: false, time: past } })).toEqual({
      kind: 'started',
      helper: 'This gathering has already started.',
    });
  });

  it('treats status cancelled as cancelled and sorts cancelled rows last', () => {
    expect(isActivityCancelled({ status: 'cancelled' })).toBe(true);
    expect(isActivityCancelled({})).toBe(false);
    const rows = [{ id: 1, is_cancelled: true }, { id: 2 }, { id: 3, is_cancelled: true }, { id: 4 }];
    expect(sortCancelledLast(rows).map((row) => row.id)).toEqual([2, 4, 1, 3]);
  });

  it('clamps the reason to 280 and omits it when blank', () => {
    expect(clampReason('x'.repeat(400))).toHaveLength(280);
    expect(cancelEventBody('   ')).toEqual({});
    expect(cancelEventBody('  Rain  ')).toEqual({ reason: 'Rain' });
  });

  it('maps failures to toasts', () => {
    expect(describeCancelEventError(err(400, { detail: 'This gathering has already started.' }))).toEqual({
      message: 'This gathering has already started.',
      closeAndRefresh: true,
    });
    expect(describeCancelEventError(err(404)).closeAndRefresh).toBe(false);
    expect(describeCancelEventError(err(405)).message).toBe(describeCancelEventError(err(404)).message);
    expect(describeCancelEventError(err(403)).message).not.toBe(describeCancelEventError(err(500)).message);
    expect(isCancelledMessage('This gathering was cancelled by the host.')).toBe(true);
  });
});
