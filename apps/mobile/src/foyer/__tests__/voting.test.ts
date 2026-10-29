import {
  DEFAULT_OPTIONS,
  VOTING_BACKEND_GAPS,
  VOTING_COPY,
  VOTE_RUBRIC,
  addOption,
  audienceChip,
  buildVoteCreate,
  canCreateVote,
  castPayload,
  detailChips,
  formatClosedOn,
  formatClosesAt,
  initialAdminCircleIds,
  normalizeVote,
  normalizeVoteCircles,
  normalizeVoteList,
  optionShare,
  removeOption,
  sectionVotes,
  talliesVisible,
  votePaths,
  voteRowSubline,
  type Vote,
} from '@shared/voting';

const now = new Date('2026-10-28T15:00:00.000Z');

const baseInput = {
  title: 'Affirm the 2027 budget',
  description: 'As presented Sunday.',
  options: DEFAULT_OPTIONS,
  circleIds: ['4'] as Array<number | string>,
  wholeChurch: false,
  closesAt: '2026-11-01T20:00:00.000Z',
  resultsMode: 'after_close' as const,
  isChurchAdmin: false,
  now,
};

const sample = (partial: Partial<Vote> = {}): Vote => ({
  id: 1,
  title: 'Affirm the 2027 budget',
  description: '',
  closesAt: '2026-11-08T01:00:00.000Z',
  closedAt: null,
  resultsMode: 'after_close',
  audience: 'circles',
  circles: [{ id: 3, name: 'Young Adults' }],
  churchName: 'Franconia Mennonite Church',
  options: [
    { id: 1, label: 'Yes', count: null },
    { id: 2, label: 'No', count: null },
  ],
  myOptionId: null,
  hasVoted: false,
  canClose: false,
  status: null,
  createdAt: '2026-10-28T12:00:00.000Z',
  ...partial,
});

describe('create a vote', () => {
  it('requires a title, two distinct choices, an audience, and a future close', () => {
    expect(buildVoteCreate({ ...baseInput, title: '  ' })).toMatchObject({ ok: false, field: 'title' });
    expect(buildVoteCreate({ ...baseInput, options: ['Yes'] })).toMatchObject({ ok: false, field: 'options' });
    expect(buildVoteCreate({ ...baseInput, options: ['Yes', ' yes '] })).toMatchObject({
      ok: false,
      field: 'options',
      message: VOTING_COPY.optionsDistinct,
    });
    expect(buildVoteCreate({ ...baseInput, circleIds: [], wholeChurch: false })).toMatchObject({
      ok: false,
      field: 'audience',
    });
    expect(buildVoteCreate({ ...baseInput, closesAt: '2026-10-28T14:00:00.000Z' })).toMatchObject({
      ok: false,
      field: 'closes',
      message: VOTING_COPY.closesFuture,
    });
    expect(buildVoteCreate(baseInput)).toEqual({
      ok: true,
      payload: {
        title: 'Affirm the 2027 budget',
        description: 'As presented Sunday.',
        options: ['Yes', 'No'],
        audience: 'circles',
        circle_ids: [4],
        closes_at: '2026-11-01T20:00:00.000Z',
        results_mode: 'after_close',
      },
    });
  });

  it('keeps whole church off unless a church admin turns it on', () => {
    expect(buildVoteCreate({ ...baseInput, wholeChurch: true, isChurchAdmin: false, circleIds: [] })).toMatchObject({
      ok: false,
      field: 'audience',
      message: VOTING_COPY.churchAdminRequired,
    });
    expect(
      buildVoteCreate({ ...baseInput, wholeChurch: true, isChurchAdmin: true, circleIds: [4], resultsMode: 'live' }),
    ).toMatchObject({
      ok: true,
      payload: { audience: 'church', circle_ids: [], results_mode: 'live' },
    });
  });

  it('does not ask the person to read the rubric before posting', () => {
    expect(VOTE_RUBRIC.map((item) => item.title)).toEqual([
      'One clear question',
      'Neutral choices',
      'Right circle',
      'A real close time',
      'No change after vote',
    ]);
    expect(buildVoteCreate(baseInput).ok).toBe(true);
    expect(addOption(['Yes', 'No'])).toEqual(['Yes', 'No', '']);
    expect(addOption(['1', '2', '3', '4', '5', '6'])).toHaveLength(6);
    expect(removeOption(['Yes', 'No', 'Later'], 2)).toEqual(['Yes', 'No']);
    expect(removeOption(['Yes', 'No'], 0)).toEqual(['Yes', 'No']);
  });

  it('defaults to the first circle the person admins', () => {
    const circles = [
      { id: 2, name: 'Care Team', isAdmin: false, isMember: true },
      { id: 9, name: 'Elders', isAdmin: true },
    ];
    expect(initialAdminCircleIds(circles, true, [])).toEqual([9]);
    expect(initialAdminCircleIds(circles, false, [])).toEqual([]);
    expect(initialAdminCircleIds(circles, true, [2])).toEqual([2]);
    expect(canCreateVote({ isChurchAdmin: false, circles })).toBe(true);
    expect(canCreateVote({ isChurchAdmin: false, circles: [circles[0]] })).toBe(false);
    expect(canCreateVote({ isChurchAdmin: true, circles: [] })).toBe(true);
  });
});

describe('ballot list and results', () => {
  it('formats the row subline and the audience chip', () => {
    const localClose = new Date(2026, 10, 1, 20, 0, 0);
    expect(formatClosesAt(localClose.toISOString())).toBe('Sun, Nov 1 · 8:00 PM');
    expect(formatClosedOn(new Date(2026, 9, 28, 15).toISOString())).toBe('Oct 28');
    const open = sample();
    expect(voteRowSubline(open, now)).toBe(`Closes ${formatClosesAt(open.closesAt)}`);
    const closed = sample({ status: 'closed', closedAt: '2026-10-28T18:00:00.000Z' });
    expect(voteRowSubline(closed, now)).toBe(`Closed ${formatClosedOn(closed.closedAt)}`);
    expect(audienceChip(open)).toBe('Young Adults');
    expect(audienceChip(sample({ audience: 'church', circles: [] }))).toBe('Franconia Mennonite Church');
    expect(detailChips(open)).toEqual(['Voting', 'Young Adults']);
  });

  it('splits open and closed, newest first, and hides tallies until close', () => {
    const older = sample({ id: 1, createdAt: '2026-10-20T12:00:00.000Z' });
    const newer = sample({ id: 2, createdAt: '2026-10-27T12:00:00.000Z', hasVoted: true });
    const done = sample({
      id: 3,
      status: 'closed',
      closedAt: '2026-10-28T12:00:00.000Z',
      createdAt: '2026-10-01T12:00:00.000Z',
      options: [
        { id: 1, label: 'Yes', count: 8 },
        { id: 2, label: 'No', count: 2 },
      ],
    });
    const sections = sectionVotes([older, done, newer], now);
    expect(sections.open.map((vote) => vote.id)).toEqual([2, 1]);
    expect(sections.closed.map((vote) => vote.id)).toEqual([3]);
    const expired = sample({ id: 4, status: 'open', closesAt: '2026-10-28T14:00:00.000Z' });
    expect(sectionVotes([expired], now).closed.map((vote) => vote.id)).toEqual([4]);
    expect(talliesVisible(newer, now)).toBe(false);
    expect(talliesVisible(sample({ resultsMode: 'live' }), now)).toBe(true);
    expect(talliesVisible(done, now)).toBe(true);
    expect(optionShare(8, 10)).toBe(80);
    expect(optionShare(null, 10)).toBeNull();
  });
});

describe('tip payload', () => {
  const raw = {
    id: 8,
    title: 'Affirm the 2027 budget',
    description: 'As presented.',
    closes_at: '2026-11-01T20:00:00Z',
    results_mode: 'after_close',
    audience: 'circles',
    circles: [{ id: 3, name: 'Young Adults', is_admin: true }],
    church_name: 'Franconia Mennonite Church',
    options: [
      { id: 1, label: 'Yes' },
      { id: 2, label: 'No', count: null },
    ],
    has_voted: false,
    can_close: true,
    created_at: '2026-10-28T12:00:00Z',
  };

  it('reads a vote, a page, and split open and closed lists', () => {
    const vote = normalizeVote(raw);
    expect(vote?.canClose).toBe(true);
    expect(vote?.options[0].count).toBeNull();
    expect(vote?.audience).toBe('circles');
    expect(vote?.hasVoted).toBe(false);
    expect(normalizeVote({ id: 1 })).toBeNull();
    expect(normalizeVoteList({ count: 1, next: null, previous: null, results: [raw] })).toHaveLength(1);
    const split = normalizeVoteList({ open: [raw], closed: [{ ...raw, id: 9, title: 'Done', status: 'open' }] });
    expect(split.map((vote) => vote.status)).toEqual([null, 'closed']);
    expect(normalizeVoteCircles({ circles: [{ id: 3, name: 'Elders', is_admin: true, is_member: true }] })[0]).toMatchObject({
      id: 3,
      isAdmin: true,
      isMember: true,
    });
    expect(castPayload('4')).toEqual({ option_id: 4 });
  });

  it('calls the tip paths and records the backend gaps', () => {
    expect(votePaths.list().endsWith('/votes/')).toBe(true);
    expect(votePaths.detail(8).endsWith('/votes/8/')).toBe(true);
    expect(votePaths.cast(8).endsWith('/votes/8/cast/')).toBe(true);
    expect(votePaths.close(8).endsWith('/votes/8/close/')).toBe(true);
    expect(votePaths.circles().endsWith('/circles/')).toBe(true);
    expect(VOTING_BACKEND_GAPS.join(' ')).toMatch(/unique/);
    expect(VOTING_BACKEND_GAPS.join(' ')).toMatch(/kid/);
    expect(VOTING_COPY.submitOnce).toBe('Members submit once.');
    expect(VOTING_COPY.emptyTitle).toBe('No votes yet');
    expect(VOTING_COPY.submitFailed).toBe("Couldn't submit your vote. Try again.");
  });
});
