import {
  buildPrayerCreate,
  circleChoiceLabel,
  initialCircleIds,
  normalizeCircles,
  normalizePrayer,
  normalizePrayerChat,
  normalizePrayerList,
  prayerChatBanner,
  prayerChatHeading,
  prayerListMeta,
  prayerPaths,
  selectedCircleLabel,
  visibleToLabel,
} from '@shared/prayer';
import { circlePaths, pickerCircles } from '@shared/circles';

describe('prayer visibility', () => {
  it('requires a title and a circle while whole church is off', () => {
    expect(buildPrayerCreate({ title: '  ', details: '', circleIds: [1], wholeChurch: false })).toMatchObject({
      ok: false,
      field: 'title',
    });
    expect(buildPrayerCreate({ title: 'Pray for dad', details: '', circleIds: [], wholeChurch: false })).toMatchObject({
      ok: false,
      field: 'circles',
    });
    expect(buildPrayerCreate({ title: 'Pray for dad', details: 'Quiet prayers.', circleIds: ['4'], wholeChurch: false })).toEqual({
      ok: true,
      payload: { title: 'Pray for dad', details: 'Quiet prayers.', whole_church: false, circle_ids: [4] },
    });
  });

  it('lets whole church be opted in, and still sends any chosen circles', () => {
    expect(buildPrayerCreate({ title: 'Pray for dad', details: '', circleIds: [], wholeChurch: true })).toEqual({
      ok: true,
      payload: { title: 'Pray for dad', details: '', whole_church: true, circle_ids: [] },
    });
    expect(buildPrayerCreate({ title: 'Pray for dad', details: 'Held.', circleIds: [9], wholeChurch: true })).toEqual({
      ok: true,
      payload: { title: 'Pray for dad', details: 'Held.', whole_church: true, circle_ids: [9] },
    });
  });

  it('defaults the picker to the first circle the person belongs to', () => {
    const circles = [
      { id: 2, name: 'Care Team', isMember: false },
      { id: 1, name: 'Young Adults', isMember: true },
    ];
    expect(initialCircleIds(circles, true, [])).toEqual([1]);
    expect(initialCircleIds(circles, false, [])).toEqual([]);
    expect(initialCircleIds(circles, true, [2])).toEqual([2]);
    expect(selectedCircleLabel(circles, [1])).toBe('Young Adults circle');
    expect(circleChoiceLabel('Care Team circle')).toBe('Care Team circle');
  });

  it('uses the prayer and circle paths from the backend contract', () => {
    expect(prayerPaths.list('discover').endsWith('/prayers/')).toBe(true);
    expect(prayerPaths.list('active').endsWith('/prayers/active/')).toBe(true);
    expect(prayerPaths.list('mine').endsWith('/prayers/mine/')).toBe(true);
    expect(prayerPaths.chat(8).endsWith('/prayers/8/chat/')).toBe(true);
    expect(circlePaths.joinRequests(3)).toBe('/api/circles/3/join-requests/');
    expect(circlePaths.leave(3)).toBe('/api/circles/3/leave/');
    expect(Object.keys(circlePaths)).not.toContain('join');
  });
});

describe('prayer copy helpers', () => {
  const request = {
    id: 1,
    title: "Pray for my dad's surgery Thursday",
    details: 'Knee replacement.',
    wholeChurch: false,
    circles: [{ id: 3, name: 'Young Adults' }],
    author: { id: 2, firstName: 'Sarah', lastName: 'L', name: 'Sarah L.' },
    prayingCount: 12,
    viewerIsPraying: true,
    isAuthor: false,
    conversationId: 4,
    visibilitySummary: 'Young Adults',
    createdAt: '2026-10-28T12:00:00Z',
    churchName: 'Franconia Mennonite Church',
  };

  it('matches the tab row, detail visibility, and chat heading', () => {
    expect(prayerListMeta(request)).toEqual({ count: '12 praying', rest: " · Young Adults · You're praying" });
    expect(visibleToLabel(request)).toBe('Visible to Young Adults circle');
    expect(visibleToLabel({ ...request, wholeChurch: true, circles: [] })).toBe('Visible to the whole church');
    expect(prayerChatHeading(request.title)).toBe("Praying for: my dad's surgery Thursday");
    expect(prayerChatBanner(12)).toBe('12 people are praying for this. Report or leave anytime.');
    expect(prayerChatBanner(1)).toBe('1 person is praying for this. Report or leave anytime.');
  });
});

describe('prayer response normalization', () => {
  it('reads a Django object or a paginated list', () => {
    const raw = {
      id: 8,
      title: 'Peace for the Miller family',
      details: 'A hard week.',
      whole_church: true,
      circles: [],
      author: { id: 4, first_name: 'Sarah', last_initial: 'L', display_name: 'Sarah L.' },
      praying_count: 27,
      is_praying: false,
      is_author: true,
      visibility_summary: 'Whole church',
      created_at: '2026-10-28T08:05:00Z',
    };
    expect(normalizePrayer(raw)?.author.name).toBe('Sarah L.');
    expect(normalizePrayer(raw)?.wholeChurch).toBe(true);
    expect(normalizePrayer(raw)?.visibilitySummary).toBe('Whole church');
    expect(normalizePrayer(raw)?.viewerIsPraying).toBe(false);
    expect(normalizePrayerList({ results: [raw] })).toHaveLength(1);
    expect(normalizePrayer({ id: 1 })).toBeNull();
    expect(normalizeCircles({ church_id: 1, circles: [{ id: 3, name: 'Young Adults', is_member: true, membership_state: 'joined' }] })[0]).toMatchObject({
      id: 3,
      name: 'Young Adults',
      isMember: true,
      membershipState: 'joined',
    });
    const directory = normalizeCircles({
      circles: [
        { id: 1, name: 'Young Adults', is_member: true, membership_state: 'joined' },
        { id: 2, name: 'Parents', is_member: false, membership_state: 'pending' },
        { id: 4, name: 'Choir', is_member: false, membership_state: 'invited' },
      ],
    });
    expect(pickerCircles(directory).map((circle) => circle.id)).toEqual([1]);
    expect(initialCircleIds(directory, true, [])).toEqual([1]);
    expect(normalizePrayerChat({ conversation_id: 9, praying_for: 'Dad', praying_count: 2, messages: [] }).conversationId).toBe(9);
  });
});
