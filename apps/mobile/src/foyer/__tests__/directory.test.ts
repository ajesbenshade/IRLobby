import {
  DIRECTORY_BACKEND_GAPS,
  DIRECTORY_COPY,
  birthdaysThisWeek,
  directoryDisplayName,
  directoryListingNudge,
  directoryPayloadLeaksPrivateChildData,
  directorySections,
  directoryUsesServerSearch,
  filterDirectory,
  normalizeDirectoryPage,
  showDirectoryViewerCard,
  wishFriendsLine,
  wishPresets,
} from '@shared/directory';

const raw = {
  count: 2,
  next: null,
  results: [
    {
      id: 7,
      first_name: 'Maria',
      last_initial: 'S',
      avatar_url: 'https://cdn.example/maria.jpg',
      last_name: 'Smith',
      email: 'maria@example.com',
      birthday: { month: 3, day: 4, year: 1990 },
      household_children: [
        {
          id: 3,
          first_name: 'Noah',
          birth_month: 3,
          birth_day: 4,
          birth_year: 2018,
          date_of_birth: '2018-03-04',
          last_name: 'Smith',
          sex: 'male',
          avatar_url: 'https://cdn.example/noah.jpg',
        },
        { id: 4, first_name: 'Ada', birth_month: 1, birth_day: null },
      ],
    },
    { id: 2, first_name: 'aaron', last_initial: 'e', avatar_url: '', household_children: [] },
  ],
};

describe('directory list', () => {
  const page = normalizeDirectoryPage(raw);

  it('keeps adult name, initial, and photo, and nests only complete month/day children', () => {
    expect(page.results.map((row) => directoryDisplayName(row))).toEqual(['Maria S.', 'aaron E.']);
    expect(page.results[0].householdChildren).toEqual([{ id: 3, firstName: 'Noah', birthMonth: 3, birthDay: 4 }]);
    expect(page.results[0].birthdayMonth).toBe(3);
    expect(page.results[0].birthdayDay).toBe(4);
    expect(directoryPayloadLeaksPrivateChildData(page)).toBe(false);
    expect(JSON.stringify(page)).not.toMatch(/2018|1990|Smith/);
  });

  it('groups A–Z by first name and filters first name plus last initial', () => {
    const sections = directorySections(page.results);
    expect(sections.map((section) => section.letter)).toEqual(['A', 'M']);
    expect(filterDirectory(page.results, 'maria s').map((row) => row.id)).toEqual([7]);
    expect(filterDirectory(page.results, 'zzz')).toEqual([]);
  });

  it('asks the server to search only after 200 people', () => {
    expect(directoryUsesServerSearch(20, 20)).toBe(false);
    expect(directoryUsesServerSearch(201, 20)).toBe(true);
  });

  it('lists this week’s children and never a year', () => {
    const week = birthdaysThisWeek(page.results, new Date(2026, 2, 2));
    expect(week.map((item) => item.name)).toEqual(['Maria S.', 'Noah']);
    expect(week[0].daysUntil).toBe(2);
    const today = birthdaysThisWeek(page.results, new Date(2026, 2, 4));
    expect(today[0].daysUntil).toBe(0);
    expect(birthdaysThisWeek(page.results, new Date(2026, 5, 1))).toEqual([]);
  });

  it('locks empty, hidden, and wish copy', () => {
    expect(DIRECTORY_COPY.emptyTitle).toBe('No one in the directory yet');
    expect(DIRECTORY_COPY.searchEmpty).toBe('No one found. Try another name.');
    expect(DIRECTORY_COPY.errorTitle).toBe("Couldn't load the directory.");
    expect(directoryListingNudge('church')).toBe("You'll be listed in the church Directory.");
    expect(directoryListingNudge('only_me')).toBe("You won't appear in the Directory.");
    expect(showDirectoryViewerCard('only_me')).toBe(true);
    expect(showDirectoryViewerCard('church')).toBe(false);
    expect(wishPresets('Noah')[0]).toBe('Happy birthday, Noah!');
    expect(wishFriendsLine('Aaron')).toBe("You can send birthday wishes when you're friends with Aaron.");
    expect(DIRECTORY_BACKEND_GAPS.join(' ')).toMatch(/POST \/api\/directory\/wishes\//);
    expect(DIRECTORY_BACKEND_GAPS.join(' ')).toMatch(/birthday/);
  });
});
