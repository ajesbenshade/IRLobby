import {
  CIRCLE_COPY,
  buildCircleCreate,
  circleDetailActions,
  circleFailureMessage,
  circlePaths,
  directoryChip,
  directoryEmptyCopy,
  inviteLine,
  isLastAdmin,
  leaveConfirmCopy,
  memberCountLabel,
  normalizeCircleDetail,
  normalizeInvites,
  normalizeJoinRequests,
} from '@shared/circles';

describe('circles join policy A', () => {
  it('maps directory chips and detail actions from membership state', () => {
    expect(directoryChip({ membershipState: 'joined' })).toBe('You are in');
    expect(directoryChip({ membershipState: 'pending' })).toBe('Request sent');
    expect(directoryChip({ membershipState: 'none' })).toBeNull();
    expect(directoryChip({ membershipState: 'invited' })).toBeNull();
    expect(circleDetailActions({ membershipState: 'none' })).toEqual(['request']);
    expect(circleDetailActions({ membershipState: 'pending' })).toEqual(['pending']);
    expect(circleDetailActions({ membershipState: 'joined', isAdmin: false })).toEqual(['leave']);
    expect(circleDetailActions({ membershipState: 'joined', isAdmin: true })).toEqual(['invite', 'manage']);
    expect(circleDetailActions({ membershipState: 'invited' })).toEqual(['accept']);
  });

  it('uses the locked copy for invites, leave, empty states, and the last admin', () => {
    expect(inviteLine('Sarah M.', 'Young Adults')).toBe('Sarah M. invited you to Young Adults');
    expect(leaveConfirmCopy('Young Adults')).toBe('Leave Young Adults? You can request to join again later.');
    expect(directoryEmptyCopy('', 0)).toBe(CIRCLE_COPY.emptyDirectory);
    expect(directoryEmptyCopy('hall', 0)).toBe(CIRCLE_COPY.noMatch);
    expect(directoryEmptyCopy('hall', 1)).toBeNull();
    expect(memberCountLabel(1)).toBe('1 member');
    expect(memberCountLabel(3)).toBe('3 members');
    expect(circleFailureMessage({ detail: 'Circles need at least one admin.', code: 'last_admin' }, 'nope')).toEqual({
      message: 'Circles need at least one admin.',
      code: 'last_admin',
    });
    expect(isLastAdmin([{ id: 1, isAdmin: true }, { id: 2, isAdmin: false }], 1)).toBe(true);
    expect(isLastAdmin([{ id: 1, isAdmin: true }, { id: 2, isAdmin: true }], 1)).toBe(false);
  });

  it('requires a name and reads detail, requests, and invites', () => {
    expect(buildCircleCreate({ name: '  ', description: '' })).toMatchObject({ ok: false, message: CIRCLE_COPY.nameRequired });
    expect(buildCircleCreate({ name: 'Upper Fellowship Hall Sunday school', description: 'Sunday' })).toEqual({
      ok: true,
      payload: { name: 'Upper Fellowship Hall Sunday school', description: 'Sunday' },
    });
    const detail = normalizeCircleDetail({
      id: 7,
      name: 'Young Adults',
      description: 'Upper hall',
      member_count: 2,
      is_member: true,
      is_admin: true,
      membership_state: 'joined',
      members_preview: [{ id: 1, first_name: 'Sarah', last_initial: 'M', display_name: 'Sarah M.', is_admin: true }],
    });
    expect(detail?.membersPreview[0].name).toBe('Sarah M.');
    expect(detail?.isAdmin).toBe(true);
    expect(normalizeJoinRequests({ requests: [{ id: 5, circle_id: 7, status: 'pending', user: { id: 2, display_name: 'Anna L.' } }] })[0].user.name).toBe('Anna L.');
    const inbox = normalizeInvites({
      invites: [
        {
          id: 9,
          circle_id: 7,
          status: 'pending',
          invitee: { id: 2, display_name: 'Anna L.' },
          inviter: { id: 1, display_name: 'Sarah M.' },
          circle: { id: 7, name: 'Young Adults', member_count: 3 },
        },
      ],
    });
    expect(inviteLine(inbox.invites[0].inviter?.name ?? '', inbox.invites[0].circleName)).toBe(
      'Sarah M. invited you to Young Adults',
    );
  });

  it('calls join requests and invites, not open join', () => {
    expect(circlePaths.list('Hall')).toBe('/api/circles/?q=Hall');
    expect(circlePaths.inbox()).toBe('/api/circles/invites/');
    expect(circlePaths.acceptInvite(9)).toBe('/api/circles/invites/9/accept/');
    expect(circlePaths.approveRequest(3, 5)).toBe('/api/circles/3/join-requests/5/approve/');
    expect(circlePaths.people(3, 'ann')).toBe('/api/circles/3/people/?q=ann');
    expect(circlePaths.makeAdmin(3, 2)).toBe('/api/circles/3/members/2/make-admin/');
    expect(circlePaths.report(3)).toBe('/api/circles/3/report/');
    const paths = [
      circlePaths.list(),
      circlePaths.create(),
      circlePaths.detail(1),
      circlePaths.joinRequests(1),
      circlePaths.approveRequest(1, 2),
      circlePaths.declineRequest(1, 2),
      circlePaths.invites(1),
      circlePaths.inbox(),
      circlePaths.acceptInvite(1),
      circlePaths.declineInvite(1),
      circlePaths.members(1),
      circlePaths.removeMember(1, 2),
      circlePaths.makeAdmin(1, 2),
      circlePaths.removeAdmin(1, 2),
      circlePaths.leave(1),
      circlePaths.people(1, ''),
      circlePaths.report(1),
    ];
    expect(paths.some((path) => /\/join\/$/.test(path) || path.includes('/join/?'))).toBe(false);
  });
});
