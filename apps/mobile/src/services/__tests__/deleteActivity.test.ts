jest.mock('../apiClient', () => ({ api: { delete: jest.fn().mockResolvedValue({ status: 204 }) } }));
jest.mock('../analytics', () => ({ track: jest.fn(), trackFirstJoinOnce: jest.fn() }));

import { deleteActivity } from '../activityService';

const { api } = jest.requireMock('../apiClient') as { api: { delete: jest.Mock } };

it('DELETEs /api/activities/<id>/', async () => {
  await deleteActivity(12);
  expect(api.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/activities\/12\/$/));
});
