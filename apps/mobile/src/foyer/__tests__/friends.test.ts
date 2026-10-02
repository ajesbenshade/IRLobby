import { contactKind, filterFriends, profileView, splitRequests } from '../friends';

const base = { id: 1, first_name: 'Maria', visible: true } as const;

describe('member profile states', () => {
  it('not friends: Add friend with the messaging note', () => {
    expect(profileView({ ...base, friendship: 'none' })).toMatchObject({
      state: 'visible',
      action: 'add_friend',
      showMessagingNote: true,
      showOverflow: true,
    });
  });
  it('pending outgoing: disabled Request sent plus Cancel request', () => {
    expect(profileView({ ...base, friendship: 'pending_outgoing' })).toMatchObject({
      action: 'request_sent',
      showCancelRequest: true,
    });
  });
  it('pending incoming: Accept / Decline', () => {
    expect(profileView({ ...base, friendship: 'pending_incoming' })).toMatchObject({ action: 'accept_request' });
  });
  it('friends: Message and Friends ✓', () => {
    expect(profileView({ ...base, friendship: 'friends' })).toMatchObject({
      action: 'message',
      showFriendsCheck: true,
      showMessagingNote: false,
    });
  });
  it('blocked or unreachable (404 → null): no actions at all', () => {
    expect(profileView(null)).toEqual({ state: 'blocked' });
  });
  it('not visible: limited view, still Add friend', () => {
    expect(profileView({ ...base, visible: false, friendship: 'none' })).toMatchObject({
      state: 'limited',
      action: 'add_friend',
    });
  });
  it('your own profile has no actions and no report/block', () => {
    expect(profileView({ ...base, friendship: 'self' })).toMatchObject({ action: 'none', showOverflow: false });
  });
});

describe('contact and lists', () => {
  it('contact rows only appear for keys the API sent', () => {
    expect(contactKind({})).toBeNull();
    expect(contactKind({ phone: '+1215' })).toBe('phone');
    expect(contactKind({ email: 'a@b.c' })).toBe('email');
    expect(contactKind({ phone: '+1215', email: 'a@b.c' })).toBe('both');
  });
  it('searches friends by first name', () => {
    const friends = [{ first_name: 'Maria' }, { first_name: 'Tom' }];
    expect(filterFriends(friends, 'mar')).toEqual([{ first_name: 'Maria' }]);
    expect(filterFriends(friends, '')).toHaveLength(2);
  });
  it('splits requests into received and sent', () => {
    const items = [
      { id: 1, direction: 'incoming', status: 'pending', user: { id: 2, first_name: 'A' } },
      { id: 2, direction: 'outgoing', status: 'pending', user: { id: 3, first_name: 'B' } },
    ] as never;
    expect(splitRequests(items).incoming).toHaveLength(1);
    expect(splitRequests(items).outgoing).toHaveLength(1);
  });
});
