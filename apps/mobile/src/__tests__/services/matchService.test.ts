import { api } from '@services/apiClient';
import { fetchMatches } from '@services/matchService';

jest.mock('@services/apiClient', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockedGet = api.get as jest.Mock;

const sampleMatch = {
  id: 7,
  activity: 'Sunset rooftop',
  user_a: 'Ada',
  user_b: 'Kai',
  created_at: '2026-09-06T17:00:00Z',
};

describe('fetchMatches', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('returns a bare array payload', async () => {
    mockedGet.mockResolvedValue({ data: [sampleMatch] });

    await expect(fetchMatches()).resolves.toEqual([sampleMatch]);
  });

  it('unwraps a DRF paginated { results } payload', async () => {
    mockedGet.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [sampleMatch],
      },
    });

    await expect(fetchMatches()).resolves.toEqual([sampleMatch]);
  });

  it('returns an empty list for an unexpected object payload', async () => {
    mockedGet.mockResolvedValue({ data: { count: 0, next: null, previous: null } });

    await expect(fetchMatches()).resolves.toEqual([]);
  });
});
