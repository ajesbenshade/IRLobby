import { AxiosError, AxiosHeaders } from 'axios';

import { api } from '@services/apiClient';
import { castVote, closeVoteEarly, createVote, fetchVote, fetchVotes } from '@services/votingService';

jest.mock('@services/apiClient', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedGet = api.get as jest.Mock;
const mockedPost = api.post as jest.Mock;

const axiosError = (status: number, data: unknown) => {
  const error = new AxiosError('Request failed', String(status));
  error.response = {
    status,
    data,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  } as never;
  return error;
};

const ballot = {
  id: 8,
  title: 'Approve the 2027 budget',
  description: '',
  whole_church: false,
  circles: [{ id: 3, name: 'Young Adults' }],
  closes_at: '2026-11-20T21:00:00Z',
  closed_at: null,
  is_open: true,
  results_mode: 'after_close',
  results_visible: false,
  has_voted: false,
  my_choice_id: null,
  can_vote: true,
  can_close: false,
  choices: [
    { id: 10, label: 'Yes', position: 0, vote_count: null },
    { id: 11, label: 'No', position: 1, vote_count: null },
  ],
  total_votes: null,
  created_at: '2026-10-29T14:00:00Z',
};

describe('voting client talks to /api/votes/ballots/', () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it('lists open and closed ballots and keeps a null count null', async () => {
    mockedGet.mockResolvedValue({
      data: {
        open: [ballot],
        closed: [{ ...ballot, id: 9, title: 'Done', is_open: false, vote_count: 0 }],
      },
    });
    const result = await fetchVotes();
    expect(mockedGet).toHaveBeenCalledWith('/api/votes/ballots/');
    expect(result.unavailable).toBe(false);
    expect(result.votes).toHaveLength(2);
    expect(result.votes[0].options[0].count).toBeNull();
    expect(result.votes[0].totalVotes).toBeNull();
    expect(result.votes[1].status).toBe('closed');
  });

  it('shows the empty tab for an empty list and for a non-voting member', async () => {
    mockedGet.mockResolvedValueOnce({ data: { open: [], closed: [] } });
    await expect(fetchVotes()).resolves.toEqual({ votes: [], unavailable: false });

    mockedGet.mockRejectedValueOnce(
      axiosError(403, { detail: 'Voting is for voting members.', code: 'not_voting_member' }),
    );
    await expect(fetchVotes()).resolves.toEqual({ votes: [], unavailable: true });

    mockedGet.mockRejectedValueOnce(axiosError(404, { detail: 'Not found.' }));
    await expect(fetchVotes()).resolves.toEqual({ votes: [], unavailable: true });

    mockedGet.mockRejectedValueOnce(axiosError(500, { detail: 'Boom' }));
    await expect(fetchVotes()).rejects.toMatchObject({ message: 'Boom' });
  });

  it('loads one ballot, posts choice_id, and closes on the live paths', async () => {
    mockedGet.mockResolvedValue({ data: ballot });
    const loaded = await fetchVote(8);
    expect(mockedGet).toHaveBeenCalledWith('/api/votes/ballots/8/');
    expect(loaded.options.map((option) => option.count)).toEqual([null, null]);

    mockedPost.mockResolvedValue({
      data: {
        ...ballot,
        has_voted: true,
        my_choice_id: 10,
        can_vote: false,
        results_visible: true,
        total_votes: 1,
        choices: [
          { id: 10, label: 'Yes', position: 0, vote_count: 1 },
          { id: 11, label: 'No', position: 1, vote_count: 0 },
        ],
      },
    });
    const cast = await castVote(8, '10');
    expect(mockedPost).toHaveBeenCalledWith('/api/votes/ballots/8/vote/', { choice_id: 10 });
    expect(cast?.myOptionId).toBe(10);
    expect(cast?.hasVoted).toBe(true);
    expect(cast?.canVote).toBe(false);
    expect(cast?.options.map((option) => option.count)).toEqual([1, 0]);

    await closeVoteEarly(8);
    expect(mockedPost).toHaveBeenCalledWith('/api/votes/ballots/8/close/', {});
  });

  it('creates with choices and whole_church off unless the church admin opts in', async () => {
    mockedPost.mockResolvedValue({ data: { ...ballot, id: 12, whole_church: false } });
    await createVote({
      title: 'Approve the 2027 budget',
      description: '',
      choices: ['Yes', 'No'],
      whole_church: false,
      circle_ids: [3],
      closes_at: '2026-11-20T21:00:00Z',
      results_mode: 'after_close',
    });
    expect(mockedPost).toHaveBeenCalledWith('/api/votes/ballots/', {
      title: 'Approve the 2027 budget',
      description: '',
      choices: ['Yes', 'No'],
      whole_church: false,
      circle_ids: [3],
      closes_at: '2026-11-20T21:00:00Z',
      results_mode: 'after_close',
    });
    const body = mockedPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('audience');
    expect(body).not.toHaveProperty('options');
    expect(body).not.toHaveProperty('voters');
  });
});
