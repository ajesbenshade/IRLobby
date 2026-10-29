import {
  connectionContextLine,
  connectionDestination,
  connectionPaths,
  formatConnectionDate,
  normalizeConnections,
  type ConnectionPeer,
} from '@shared/connections';

const peer = (overrides: Partial<ConnectionPeer> = {}): ConnectionPeer => ({
  userId: 4,
  displayName: 'Maria K.',
  avatarUrl: null,
  contextTitle: 'Youth bonfire',
  contextKind: 'gathering',
  contextId: 9,
  contextDate: null,
  contextDateLabel: null,
  profileVisible: true,
  ...overrides,
});

describe('connections contract', () => {
  it('reads GET connections as gathering then praying', () => {
    expect(connectionPaths.list().split('/').filter(Boolean)).toEqual(['api', 'users', 'connections']);
    const lists = normalizeConnections({
      gathering: [
        {
          user_id: 4,
          display_name: 'Maria K.',
          avatar_url: 'https://cdn.example/m.png',
          context_title: 'Youth bonfire',
          context_kind: 'gathering',
          context_id: 9,
          context_date: '2026-10-17',
        },
      ],
      praying: [
        {
          user_id: 8,
          display_name: 'Jonah S.',
          avatar_url: null,
          context_title: "Dad's surgery",
          context_kind: 'prayer',
          context_id: 3,
        },
      ],
    });
    expect(lists.gathering).toHaveLength(1);
    expect(lists.praying).toHaveLength(1);
    expect(connectionContextLine(lists.gathering[0])).toBe('Youth bonfire · Sat Oct 17');
    expect(connectionContextLine(lists.praying[0])).toBe("Praying for: Dad's surgery");
    expect(connectionDestination(lists.gathering[0])).toEqual({ kind: 'profile', userId: 4 });
    expect(connectionDestination(lists.praying[0])).toEqual({ kind: 'profile', userId: 8 });
  });

  it('formats a UTC calendar day as Sat Oct 17', () => {
    expect(formatConnectionDate('2026-10-17')).toBe('Sat Oct 17');
    expect(formatConnectionDate('2026-10-17T23:30:00Z')).toBe('Sat Oct 17');
    expect(formatConnectionDate('Saturday')).toBeNull();
  });

  it('prefers a server date label over the ISO date', () => {
    expect(
      connectionContextLine(peer({ contextDate: '2026-10-17', contextDateLabel: 'Sat Oct 17' })),
    ).toBe('Youth bonfire · Sat Oct 17');
  });

  it('opens prayer detail when there is no visible profile', () => {
    const lists = normalizeConnections({
      gathering: [{ display_name: 'Caleb', context_title: 'Bonfire', context_id: 1 }],
      praying: [
        { display_name: 'Anonymous', context_title: 'Surgery', context_kind: 'prayer', context_id: 12 },
        {
          user_id: 5,
          display_name: 'Ruth M.',
          context_title: 'Travel',
          context_id: 13,
          profile_visible: false,
        },
      ],
    });
    expect(lists.gathering).toEqual([]);
    expect(connectionDestination(lists.praying[0])).toEqual({ kind: 'prayer', prayerId: 12 });
    expect(connectionDestination(lists.praying[1])).toEqual({ kind: 'prayer', prayerId: 13 });
    expect(connectionContextLine(lists.praying[1])).toBe('Praying for: Travel');
  });

  it('drops blocked rows and keeps both sections when the envelope is empty', () => {
    expect(normalizeConnections({ gathering: [{ user_id: 1, display_name: 'Ada', blocked: true }], praying: [] })).toEqual({
      gathering: [],
      praying: [],
    });
    expect(normalizeConnections(null)).toEqual({ gathering: [], praying: [] });
  });
});
