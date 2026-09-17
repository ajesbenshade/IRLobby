import { API_ROUTES } from '@shared/schema';

import { api } from '@services/apiClient';
import { deleteCurrentAccount } from '@services/accountService';

jest.mock('@services/apiClient', () => ({
  api: {
    delete: jest.fn(),
  },
}));

const mockedDelete = api.delete as jest.Mock;

describe('deleteCurrentAccount', () => {
  beforeEach(() => {
    mockedDelete.mockReset();
  });

  it('DELETEs /api/users/profile/delete/ and accepts 204', async () => {
    mockedDelete.mockResolvedValue({ status: 204, data: undefined });

    await expect(deleteCurrentAccount()).resolves.toBeUndefined();

    expect(mockedDelete).toHaveBeenCalledWith(API_ROUTES.USER_PROFILE_DELETE);
    expect(API_ROUTES.USER_PROFILE_DELETE).toBe('/api/users/profile/delete/');
  });

  it('does not treat a non-204 response as success', async () => {
    mockedDelete.mockResolvedValue({ status: 200, data: { deactivated: true } });

    await expect(deleteCurrentAccount()).rejects.toThrow('Unable to delete your account.');
  });
});
