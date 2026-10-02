import { resetDetectedCapabilities } from '../capabilities';
import { approvalCardVisible, approvalPayload, canPostGathering, hostFormValuesFromActivity, shouldBlockTurnOff } from '../hostForm';
import { rowShowsChat, rowTag, splitGoingRows } from '../gatheringsList';
import { fullBlocksJoin, fullNotice, isFullMessage, isGatheringFull } from '../full';
import { isGoingRsvp } from '../rsvp';

beforeEach(() => resetDetectedCapabilities());

describe('host form approval payload', () => {
  const state = { requireApproval: true, allowRerequest: true };

  it('sends nothing when the feature is off (legacy backend)', () => {
    expect(approvalPayload({ enabled: false, listOnCalendar: false, hostAsChurch: false, state })).toEqual({});
    expect(approvalPayload({ listOnCalendar: false, hostAsChurch: false, state })).toEqual({});
  });

  it('sends the switch values when on, and forces false when the card is hidden', () => {
    expect(approvalPayload({ enabled: true, listOnCalendar: false, hostAsChurch: false, state })).toEqual({
      requires_approval: true,
      allow_rerequest: true,
    });
    expect(approvalPayload({ enabled: true, listOnCalendar: false, hostAsChurch: false, state: { requireApproval: false, allowRerequest: true } })).toEqual({
      requires_approval: false,
      allow_rerequest: false,
    });
    expect(approvalPayload({ enabled: true, listOnCalendar: true, hostAsChurch: false, state })).toEqual({
      requires_approval: false,
      allow_rerequest: false,
    });
    expect(approvalCardVisible({ enabled: true, listOnCalendar: false, hostAsChurch: true })).toBe(false);
  });

  it('blocks turning off while requests wait', () => {
    expect(shouldBlockTurnOff({ wasOn: true, turningOff: true, pendingCount: 2 })).toBe(true);
    expect(shouldBlockTurnOff({ wasOn: true, turningOff: true, pendingCount: 0 })).toBe(false);
    expect(shouldBlockTurnOff({ wasOn: false, turningOff: true, pendingCount: 2 })).toBe(false);
  });

  it('prefills edit values and gates Post on title + date', () => {
    const values = hostFormValuesFromActivity(
      { title: 'Game night', location: 'Fellowship hall', time: '2026-10-10T19:00:00', capacity: 8, requires_approval: true, allow_rerequest: true },
      true,
    );
    expect(values).toMatchObject({ title: 'Game night', place: 'Fellowship hall', capacity: '8', requireApproval: true, allowRerequest: true });
    expect(values.day).toEqual({ year: 2026, month: 10, day: 10 });
    expect(canPostGathering({ title: '', day: values.day })).toBe(false);
    expect(canPostGathering({ title: 'x', day: null })).toBe(false);
    expect(canPostGathering({ title: 'x', day: values.day, busy: true })).toBe(false);
    expect(canPostGathering({ title: 'x', day: values.day })).toBe(true);
  });
});

describe('gatherings list', () => {
  it('tags and groups rows', () => {
    const pending = { id: 1, my_request_status: 'pending', my_rsvp: { status: 'pending' } };
    const going = { id: 2, my_request_status: 'approved', my_rsvp: { status: 'confirmed', people_count: 1 } };
    const cancelled = { id: 3, is_cancelled: true, my_request_status: 'none', my_rsvp: { status: 'confirmed', people_count: 1 } };
    expect(rowTag(pending)).toBe('pending');
    expect(rowTag(going)).toBe('approved');
    expect(rowTag(cancelled)).toBe('cancelled');
    const split = splitGoingRows([cancelled, pending, going]);
    expect(split.requests.map((row) => row.id)).toEqual([1]);
    expect(split.going.map((row) => row.id)).toEqual([2, 3]);
    expect(rowShowsChat(pending)).toBe(false);
    expect(rowShowsChat(going)).toBe(true);
  });

  it('shows Closed for a request still pending after the start', () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(rowTag({ my_request_status: 'pending', time: past })).toBe('closed');
  });

  it('a pending or declined RSVP is not "going"', () => {
    expect(isGoingRsvp({ status: 'pending', people_count: 2 })).toBe(false);
    expect(isGoingRsvp({ status: 'declined', people_count: 2 })).toBe(false);
    expect(isGoingRsvp({ status: 'confirmed', people_count: 1 })).toBe(true);
  });
});

describe('full gatherings', () => {
  it('is gated on is_full and exempts host, going guests and requesters', () => {
    expect(isGatheringFull({})).toBe(false);
    expect(isGatheringFull({ is_full: false })).toBe(false);
    expect(fullBlocksJoin({ activity: { is_full: true } })).toBe(true);
    expect(fullBlocksJoin({ activity: { is_full: true }, isHost: true })).toBe(false);
    expect(fullBlocksJoin({ activity: { is_full: true }, isGoing: true })).toBe(false);
    expect(fullBlocksJoin({ activity: { is_full: true, my_request_status: 'pending' } })).toBe(false);
    expect(fullNotice(true)).toBe('This gathering is full.');
    expect(fullNotice(false)).toBeNull();
  });

  it('recognises the server full errors but not the party-too-big one', () => {
    expect(isFullMessage('This gathering is full.')).toBe(true);
    expect(isFullMessage('Activity is full')).toBe(true);
    expect(isFullMessage('Not enough spots for this party.')).toBe(false);
  });
});
