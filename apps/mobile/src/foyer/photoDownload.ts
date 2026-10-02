import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import { fetchPhotoDownloads, type DownloadablePhoto } from '@services/foyerService';

import {
  isExpired,
  runPhotoDownloads,
  type DownloadOutcome,
  type PermissionState,
} from './downloads';

/**
 * Add-only Photos permission. Called only when the person taps a Download action,
 * never at launch or when a gallery opens. Never asks for read access.
 */
export const ensureAddOnlyPermission = async (): Promise<PermissionState> => {
  const current = await MediaLibrary.getPermissionsAsync(true);
  if (current.granted) {
    return 'granted';
  }
  if (!current.canAskAgain && current.status === 'denied') {
    return 'denied';
  }
  const requested = await MediaLibrary.requestPermissionsAsync(true);
  return requested.granted ? 'granted' : requested.status === 'denied' ? 'denied' : 'undetermined';
};

const extensionOf = (filename: string) => {
  const match = /\.([A-Za-z0-9]{2,5})$/.exec(filename);
  return match ? match[1].toLowerCase() : 'jpg';
};

/** Downloads one signed link to the cache (no auth header) and returns the local uri. */
const downloadToCache = async (photo: DownloadablePhoto): Promise<string> => {
  const directory = new Directory(Paths.cache, 'foyer-photo-downloads');
  if (!directory.exists) {
    directory.create();
  }
  const target = new File(directory, `foyer-${photo.id}.${extensionOf(photo.filename)}`);
  if (target.exists) {
    target.delete();
  }
  const file = await File.downloadFileAsync(photo.url, target);
  return file.uri;
};

const removeLocal = (uri: string) => {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Cache cleanup is best effort.
  }
};

export type RunOptions = {
  activityId: number | string;
  /** Ids to save. Omit for every photo (Download all). */
  onlyIds?: number[];
  isCancelled: () => boolean;
  onProgress?: (done: number, total: number) => void;
  /** Photos from an earlier attempt (Retry). Links are refetched when any is close to expiring. */
  resume?: { remaining: DownloadablePhoto[]; alreadySaved: number; total: number };
};

/** Fetches fresh signed links, then saves the photos one at a time. */
export const savePhotosToLibrary = async (options: RunOptions): Promise<DownloadOutcome> => {
  let photos: DownloadablePhoto[];
  let alreadySaved = 0;
  let grandTotal: number | undefined;

  if (options.resume) {
    alreadySaved = options.resume.alreadySaved;
    grandTotal = options.resume.total;
    photos = options.resume.remaining;
    if (photos.some((photo) => isExpired(photo))) {
      const fresh = await fetchPhotoDownloads(options.activityId);
      const wanted = new Set(photos.map((photo) => photo.id));
      photos = fresh.filter((photo) => wanted.has(photo.id));
    }
  } else {
    const all = await fetchPhotoDownloads(options.activityId);
    photos = options.onlyIds ? all.filter((photo) => options.onlyIds?.includes(photo.id)) : all;
  }

  return runPhotoDownloads(
    photos,
    {
      download: downloadToCache,
      save: async (uri) => {
        try {
          await MediaLibrary.createAssetAsync(uri);
        } finally {
          removeLocal(uri);
        }
      },
      isCancelled: options.isCancelled,
      onProgress: options.onProgress,
    },
    alreadySaved,
    grandTotal ?? photos.length + alreadySaved,
  );
};
