import {
  ageBandLabel,
  buildPastAttendees,
  isHostAttendeeView,
  sanitizeHouseholds,
  splitVisiblePeople,
} from '../attendees';

describe('host attendee view', () => {
  const data = {
    going_count: 12,
    households: [
      {
        name: 'Aaron E.',
        people: [
          { name: 'Aaron', relationship: 'self', age_band: 'adult', email: 'a@example.com', birth_date: '1980-01-01' },
          { name: 'Eli', relationship: 'child', age_band: 'under 13' },
        ],
      },
      { name: 'Sarah L.', people: [{ name: 'Grace', relationship: 'child', age_band: '13-17' }] },
    ],
  };

  it('keeps names and age bands only (no email, birth date or location)', () => {
    const groups = sanitizeHouseholds(data as never);
    expect(JSON.stringify(groups)).not.toMatch(/example\.com|birth|1980/);
    expect(groups[0].people[0]).toEqual({ name: 'Aaron', relationship: 'self', age_band: 'adult' });
  });

  it('labels age bands', () => {
    expect(ageBandLabel('adult')).toBe('Adult');
    expect(ageBandLabel('13-17')).toBe('13–17');
    expect(ageBandLabel('under 13')).toBe('Under 13');
  });

  it('shows the first N people and the rest behind Show N more going', () => {
    const groups = sanitizeHouseholds(data as never);
    expect(splitVisiblePeople(groups, 2, false).hidden).toBe(1);
    expect(splitVisiblePeople(groups, 2, true).hidden).toBe(0);
  });

  it('only a households payload is the host view', () => {
    expect(isHostAttendeeView(data as never)).toBe(true);
    expect(isHostAttendeeView({ going_count: 2, attendees: [] })).toBe(false);
    expect(isHostAttendeeView(null)).toBe(false);
  });
});

describe('past attendees', () => {
  it('lists under-18 attendees as Family member with no link', () => {
    const list = buildPastAttendees({
      going_count: 3,
      attendees: [
        { user_id: 4, name: 'Maria K.' },
        { user_id: null, name: 'Hidden Teen' },
      ],
    });
    expect(list[0]).toMatchObject({ name: 'Maria K.', openable: true, userId: 4 });
    expect(list[1]).toMatchObject({ name: 'Family member', openable: false, isMinor: true });
    expect(JSON.stringify(list)).not.toContain('Hidden Teen');
  });

  it('is empty when the server says 403 (null)', () => {
    expect(buildPastAttendees(null)).toEqual([]);
  });
});
