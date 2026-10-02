import * as MediaLibrary from 'expo-media-library';

import { ensureAddOnlyPermission } from '@foyer/photoDownload';

jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  createAssetAsync: jest.fn(),
}));
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: { cache: '' } }));
jest.mock('@services/foyerService', () => ({ fetchPhotoDownloads: jest.fn() }));

const mocked = MediaLibrary as unknown as { getPermissionsAsync: jest.Mock; requestPermissionsAsync: jest.Mock };

describe('add-only photo permission', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for write-only access, never read access', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'undetermined' });
    mocked.requestPermissionsAsync.mockResolvedValue({ granted: true, status: 'granted' });
    await expect(ensureAddOnlyPermission()).resolves.toBe('granted');
    expect(mocked.getPermissionsAsync).toHaveBeenCalledWith(true);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledWith(true);
  });

  it('does not re-prompt when access was already granted', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: true });
    await expect(ensureAddOnlyPermission()).resolves.toBe('granted');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reports denied so the Open Settings sheet shows', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
    await expect(ensureAddOnlyPermission()).resolves.toBe('denied');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('is never requested at import time', () => {
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
