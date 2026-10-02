import { resetDetectedCapabilities } from '../capabilities';
import {
  canApprove,
  canDecline,
  declineBody,
  declineNoteFor,
  describeDecisionError,
  gatheringRequiresApproval,
  guestRequestView,
  joinButtonFor,
  parseTurnOffFallback,
  partyFits,
  requestStatusOf,
  type JoinRequest,
} from '../approval';

const err = (status: number, data: unknown = {}) => ({ response: { status, data } });
const request = (size: number, status = 'pending'): JoinRequest => ({
  id: 1,
  user_id: 2,
  status,
  party: { size },
  card: { first_name: 'Rachel' },
});

describe('require approval gating', () => {
  beforeEach(() => resetDetectedCapabilities());

  it('legacy requires_approval alone does NOT enable the feature', () => {
    const legacy = { requires_approval: true };
    expect(gatheringRequiresApproval(legacy)).toBe(false);
    expect(joinButtonFor(legacy, 'I’m going')).toMatchObject({ kind: 'join', label: 'I’m going' });
    expect(requestStatusOf({ ...legacy })).toBe('none');
  });

  it('turns on when the payload carries my_request_status or allow_rerequest', () => {
    expect(gatheringRequiresApproval({ requires_approval: true, my_request_status: 'none' })).toBe(true);
    expect(gatheringRequiresApproval({ requires_approval: true, allow_rerequest: false })).toBe(true);
    expect(gatheringRequiresApproval({ requires_approval: false, my_request_status: 'none' })).toBe(false);
  });

  it('chooses the guest button for each request state', () => {
    const base = { requires_approval: true, my_request_status: 'none' };
    expect(joinButtonFor(base, 'Join')).toMatchObject({ label: 'Request to join', disabled: false, filled: true });
    expect(joinButtonFor({ ...base, my_request_status: 'pending' }, 'Join')).toMatchObject({ label: 'Request sent', disabled: true });
    expect(joinButtonFor({ ...base, my_request_status: 'declined', allow_rerequest: true }, 'Join')).toMatchObject({
      label: 'Ask again',
      disabled: false,
    });
    expect(joinButtonFor({ ...base, my_request_status: 'declined', allow_rerequest: false }, 'Join')).toMatchObject({
      label: 'Request closed',
      disabled: true,
    });
    expect(joinButtonFor({ ...base, my_request_status: 'approved' }, 'Join').kind).toBe('join');
  });

  it('closes pending requests once the event has started', () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(guestRequestView({ my_request_status: 'pending', time: past })).toBe('pendingClosed');
    expect(guestRequestView({ my_request_status: 'declined', time: past })).toBe('declinedClosed');
    expect(guestRequestView({ my_request_status: 'pending' })).toBe('pending');
  });

  it('shows the decline note only to a declined requester with a non-empty note', () => {
    const declined = { my_request_status: 'declined', my_request_reason: '  Maybe next time  ' };
    expect(declineNoteFor(declined)).toBe('Maybe next time');
    expect(declineNoteFor({ my_request_status: 'declined', my_request_reason: '   ' })).toBeNull();
    expect(declineNoteFor({ my_request_status: 'declined', my_request_reason: null })).toBeNull();
    expect(declineNoteFor({ my_request_status: 'pending', my_request_reason: 'x' })).toBeNull();
  });
});

describe('host decisions', () => {
  it('fits unlimited and exact parties, rejects too-big ones', () => {
    expect(partyFits(request(4), null)).toBe(true);
    expect(partyFits(request(2), 2)).toBe(true);
    expect(partyFits(request(3), 2)).toBe(false);
  });

  it('follows the server rules for approve and decline', () => {
    expect(canApprove(request(1, 'pending'))).toBe(true);
    expect(canApprove(request(1, 'declined'))).toBe(true);
    expect(canApprove(request(1, 'approved'))).toBe(false);
    expect(canDecline(request(1, 'pending'))).toBe(true);
    expect(canDecline(request(1, 'approved'))).toBe(false);
  });

  it('sends the decline note only when present and clamps it to 280', () => {
    expect(declineBody('  ')).toEqual({});
    expect(declineBody(' no room ')).toEqual({ reason: 'no room' });
    expect(declineBody('y'.repeat(500)).reason).toHaveLength(280);
  });

  it('maps decision errors', () => {
    expect(describeDecisionError(err(409, { detail: 'Not enough spots for this party.' }))).toEqual({
      kind: 'noFit',
      message: 'Not enough spots for this party.',
    });
    expect(describeDecisionError(err(400, { detail: 'This gathering has already started.' })).kind).toBe('closed');
    expect(describeDecisionError(err(404)).kind).toBe('gone');
    expect(describeDecisionError(err(500)).kind).toBe('generic');
  });

  it('parses the turn-off fallback message', () => {
    expect(parseTurnOffFallback('Review your requests first. You still have 3 waiting.')).toBe(3);
    expect(parseTurnOffFallback('Something else')).toBeNull();
  });
});
