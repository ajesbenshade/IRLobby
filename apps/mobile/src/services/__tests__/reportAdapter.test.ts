import { canReport, contentReportPath, reportDescription, reportSupportFor, submitReport } from '../reportAdapter';

jest.mock('../foyerService', () => ({ reportMember: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../apiClient', () => ({ api: { post: jest.fn() } }));
const { reportMember } = jest.requireMock('../foyerService') as { reportMember: jest.Mock };
const { api } = jest.requireMock('../apiClient') as { api: { post: jest.Mock } };

const notFound = () => Object.assign(new Error('404'), { response: { status: 404 } });

describe('report adapter', () => {
  beforeEach(() => {
    reportMember.mockClear();
    api.post.mockReset();
    api.post.mockResolvedValue({ data: { id: 1, status: 'pending' } });
  });

  it('sends member and attendee reports straight to the user-report endpoint', async () => {
    await submitReport({ type: 'member', userId: 7 }, { reason: 'harassment', description: ' rude ' });
    expect(reportMember).toHaveBeenCalledWith(7, { reason: 'harassment', description: 'rude' });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('reports a gathering chat message against the message, not the person', async () => {
    await submitReport(
      { type: 'chat_message', senderId: 9, messageId: 31, activityId: 4, excerpt: 'hello there' },
      { reason: 'spam', description: ' seen twice ' },
    );
    expect(api.post).toHaveBeenCalledWith('/api/activities/4/chat/31/report/', { reason: 'spam', description: 'seen twice' });
    expect(reportMember).not.toHaveBeenCalled();
  });

  it('reports a photo without needing an owner id (gated on the photo id)', async () => {
    const target = { type: 'photo' as const, ownerId: null, photoId: 3, activityId: 2 };
    expect(canReport(target)).toBe(true);
    expect(reportSupportFor(target)).toBe('content_report');
    await submitReport(target, { reason: 'inappropriate' });
    expect(api.post).toHaveBeenCalledWith('/api/activities/2/photos/3/report/', { reason: 'inappropriate' });
    expect(canReport({ type: 'photo', ownerId: 5, photoId: null, activityId: 2 })).toBe(true); // owner fallback only
    expect(canReport({ type: 'photo', ownerId: null, photoId: null, activityId: 2 })).toBe(false);
  });

  it('reports a gathering and a requester card against their own endpoints', async () => {
    expect(contentReportPath({ type: 'gathering', activityId: 8 })).toBe('/api/activities/8/report/');
    await submitReport({ type: 'join_request', userId: 5, requestId: 12, activityId: 8 }, { reason: 'spam' });
    expect(api.post).toHaveBeenCalledWith('/api/activities/8/requests/12/report/', { reason: 'spam' });
  });

  it('caps details at 500 characters', async () => {
    await submitReport({ type: 'gathering', activityId: 8 }, { reason: 'spam', description: 'x'.repeat(600) });
    expect(api.post.mock.calls[0][1].description).toHaveLength(500);
  });

  it('falls back to the old user-report endpoint ONLY on 404 (endpoint not deployed yet)', async () => {
    api.post.mockRejectedValueOnce(notFound());
    await submitReport(
      { type: 'chat_message', senderId: 9, messageId: 31, activityId: 4, excerpt: 'hello there' },
      { reason: 'spam', description: 'seen twice' },
    );
    const [userId, body] = reportMember.mock.calls[0];
    expect(userId).toBe(9);
    expect(body.description).toContain('gathering chat message');
    expect(body.description).toContain('message 31');
    expect(body.description).toContain('seen twice');
  });

  it('does not fall back on 400, 403 or server errors, and the error reaches the sheet', async () => {
    for (const status of [400, 403, 500]) {
      api.post.mockRejectedValueOnce(Object.assign(new Error(String(status)), { response: { status } }));
      await expect(
        submitReport({ type: 'chat_message', senderId: 9, messageId: 31, activityId: 4 }, { reason: 'spam' }),
      ).rejects.toThrow(String(status));
    }
    expect(reportMember).not.toHaveBeenCalled();
  });

  it('a 404 with no known person has nothing to fall back to', async () => {
    api.post.mockRejectedValueOnce(notFound());
    await expect(submitReport({ type: 'photo', photoId: 3, activityId: 2 }, { reason: 'spam' })).rejects.toBeTruthy();
    expect(reportMember).not.toHaveBeenCalled();
  });

  it('request cards without a request id and non-friend minors with no user id cannot be reported', async () => {
    const target = { type: 'join_request', userId: null as unknown as number };
    expect(canReport(target as never)).toBe(false);
    await expect(submitReport(target as never, { reason: 'spam' })).rejects.toThrow();
    expect(reportMember).not.toHaveBeenCalled();
  });

  it('adds no context line for a plain member report', () => {
    expect(reportDescription({ type: 'member', userId: 1 })).toBeUndefined();
  });
});
