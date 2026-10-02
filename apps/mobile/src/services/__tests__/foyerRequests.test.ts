import {
  approveJoinRequest,
  cancelEvent,
  declineJoinRequest,
  fetchJoinRequests,
  withdrawJoinRequest,
} from '../foyerService';

jest.mock('../apiClient', () => ({ api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
const { api } = jest.requireMock('../apiClient') as { api: { get: jest.Mock; post: jest.Mock } };

describe('requests and cancel service calls', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it('lists requests with null avatar/bio for minors and defaults missing fields', async () => {
    api.get.mockResolvedValue({
      data: {
        pending_count: 1,
        spots_left: null,
        requests: [{ id: 3, user_id: 8, status: 'pending', party: { size: 1 }, card: { first_name: 'Sam', age_band: '14-17', avatar_url: null, bio: null } }],
      },
    });
    const result = await fetchJoinRequests(12);
    expect(api.get).toHaveBeenCalledWith('/api/activities/12/requests/', { params: { status: 'pending' } });
    expect(result.spots_left).toBeNull();
    expect(result.requests[0].card.avatar_url).toBeNull();
    api.get.mockResolvedValue({ data: {} });
    await expect(fetchJoinRequests(12)).resolves.toEqual({ pending_count: 0, spots_left: null, requests: [] });
  });

  it('approves, declines with an optional note, withdraws and cancels', async () => {
    api.post.mockResolvedValue({ data: { request: { id: 3 }, going_count: 4, spots_left: 1 } });
    await approveJoinRequest(12, 3);
    expect(api.post).toHaveBeenLastCalledWith('/api/activities/12/requests/3/approve/');
    await declineJoinRequest(12, 3, '');
    expect(api.post).toHaveBeenLastCalledWith('/api/activities/12/requests/3/decline/', {});
    await declineJoinRequest(12, 3, ' full house ');
    expect(api.post).toHaveBeenLastCalledWith('/api/activities/12/requests/3/decline/', { reason: 'full house' });
    await withdrawJoinRequest(12);
    expect(api.post).toHaveBeenLastCalledWith('/api/activities/12/rsvp/cancel/');
    await cancelEvent(12, '');
    expect(api.post).toHaveBeenLastCalledWith('/api/activities/12/cancel-event/', {});
    await cancelEvent(12, 'Storm');
    expect(api.post).toHaveBeenLastCalledWith('/api/activities/12/cancel-event/', { reason: 'Storm' });
  });
});
