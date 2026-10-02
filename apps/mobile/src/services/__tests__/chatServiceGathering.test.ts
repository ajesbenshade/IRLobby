import { fetchConversations, fetchGatheringChatMessages, sendGatheringChatMessage } from '../chatService';

jest.mock('../apiClient', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../lib/monitoring', () => ({ captureException: jest.fn() }));

const { api } = jest.requireMock('../apiClient') as { api: { get: jest.Mock; post: jest.Mock } };

describe('gathering chat service', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it('reads and sends through the per-gathering endpoint, by activity id', async () => {
    api.get.mockResolvedValue({
      data: [{ id: 1, userId: 2, user: { id: 2, firstName: 'Rachel' }, message: 'Hi', createdAt: '2026-10-03T22:00:00Z' }],
    });
    const messages = await fetchGatheringChatMessages(12);
    expect(api.get).toHaveBeenCalledWith('/api/activities/12/chat/');
    expect(messages).toEqual([expect.objectContaining({ id: 1, userId: 2, message: 'Hi' })]);

    api.post.mockResolvedValue({ data: { id: 2, userId: 1, user: { id: 1, firstName: 'Me' }, message: 'Yo', createdAt: '' } });
    await sendGatheringChatMessage(12, 'Yo');
    expect(api.post).toHaveBeenCalledWith('/api/activities/12/chat/', { message: 'Yo' });
  });

  it('keeps activityId on conversations so a gathering conversation can be told from a friend chat', async () => {
    api.get.mockResolvedValue({
      data: [
        { id: 4, match: 'Game Night', matchId: 9, activityId: 12, otherUserId: 2, messages: [], created_at: '' },
        { id: 5, match: 'Direct', matchId: 10, activityId: null, messages: [], created_at: '' },
      ],
    });
    const conversations = await fetchConversations();
    expect(conversations.map((item) => item.activityId)).toEqual([12, null]);
  });
});
