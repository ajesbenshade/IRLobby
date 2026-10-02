import { canReport, reportDescription, reportSupportFor, submitReport } from '../reportAdapter';

jest.mock('../foyerService', () => ({ reportMember: jest.fn().mockResolvedValue(undefined) }));
const { reportMember } = jest.requireMock('../foyerService') as { reportMember: jest.Mock };

describe('report adapter', () => {
  beforeEach(() => reportMember.mockClear());

  it('sends member and attendee reports straight to the user-report endpoint', async () => {
    await submitReport({ type: 'member', userId: 7 }, { reason: 'harassment', description: ' rude ' });
    expect(reportMember).toHaveBeenCalledWith(7, { reason: 'harassment', description: 'rude' });
  });

  it('folds chat message context into the description (target_type/target_id endpoint is pending)', async () => {
    await submitReport(
      { type: 'chat_message', senderId: 9, messageId: 31, activityId: 4, excerpt: 'hello there' },
      { reason: 'spam', description: 'seen twice' },
    );
    const [userId, body] = reportMember.mock.calls[0];
    expect(userId).toBe(9);
    expect(body.reason).toBe('spam');
    expect(body.description).toContain('gathering chat message');
    expect(body.description).toContain('message 31');
    expect(body.description).toContain('gathering 4');
    expect(body.description).toContain('hello there');
    expect(body.description).toContain('seen twice');
  });

  it('reports a photo against its owner, and offers nothing when the owner is unknown', async () => {
    expect(canReport({ type: 'photo', ownerId: null, photoId: 3 })).toBe(false);
    expect(reportSupportFor({ type: 'photo', ownerId: 5, photoId: 3 })).toBe('user_report');
    await submitReport({ type: 'photo', ownerId: 5, photoId: 3, activityId: 2 }, { reason: 'inappropriate' });
    expect(reportMember.mock.calls[0][0]).toBe(5);
    expect(reportMember.mock.calls[0][1].description).toContain('photo 3');
  });

  it('non-friend minors with no user id cannot be reported from a request card', async () => {
    const target = { type: 'join_request', userId: null as unknown as number };
    expect(canReport(target as never)).toBe(false);
    await expect(submitReport(target as never, { reason: 'spam' })).rejects.toThrow();
    expect(reportMember).not.toHaveBeenCalled();
  });

  it('adds no context line for a plain member report', () => {
    expect(reportDescription({ type: 'member', userId: 1 })).toBeUndefined();
  });
});
