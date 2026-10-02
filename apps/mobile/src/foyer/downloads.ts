import type { DownloadablePhoto } from '@services/foyerService';

export type DownloadOutcome = {
  total: number;
  saved: number;
  failedIds: number[];
  cancelled: boolean;
  /** Photos not yet saved (failed or never attempted). Retry continues with these. */
  remaining: DownloadablePhoto[];
};

export type DownloadDeps = {
  /** Fetches one photo to a local file and returns its uri. */
  download: (photo: DownloadablePhoto) => Promise<string>;
  /** Saves a local file to the library. */
  save: (uri: string) => Promise<void>;
  isCancelled: () => boolean;
  onProgress?: (done: number, total: number) => void;
};

/**
 * Saves photos one at a time. Cancel stops after the current photo; photos
 * already saved stay saved. A failed photo does not stop the rest.
 */
export const runPhotoDownloads = async (
  photos: DownloadablePhoto[],
  deps: DownloadDeps,
  alreadySaved = 0,
  grandTotal = photos.length + alreadySaved,
): Promise<DownloadOutcome> => {
  let saved = alreadySaved;
  const failed: DownloadablePhoto[] = [];
  const notAttempted: DownloadablePhoto[] = [];
  let cancelled = false;
  deps.onProgress?.(saved, grandTotal);

  for (let index = 0; index < photos.length; index += 1) {
    if (deps.isCancelled()) {
      cancelled = true;
      notAttempted.push(...photos.slice(index));
      break;
    }
    const photo = photos[index];
    try {
      const uri = await deps.download(photo);
      await deps.save(uri);
      saved += 1;
    } catch {
      failed.push(photo);
    }
    deps.onProgress?.(saved, grandTotal);
  }

  return {
    total: grandTotal,
    saved,
    failedIds: failed.map((photo) => photo.id),
    cancelled,
    remaining: [...failed, ...notAttempted],
  };
};

export type DownloadToast =
  | { kind: 'saved'; saved: number }
  | { kind: 'cancelled'; saved: number; total: number }
  | { kind: 'partial'; saved: number; total: number }
  | { kind: 'failed' };

export const toastForOutcome = (outcome: DownloadOutcome): DownloadToast => {
  if (outcome.cancelled) {
    return { kind: 'cancelled', saved: outcome.saved, total: outcome.total };
  }
  if (outcome.remaining.length === 0) {
    return { kind: 'saved', saved: outcome.saved };
  }
  if (outcome.saved === 0) {
    return { kind: 'failed' };
  }
  return { kind: 'partial', saved: outcome.saved, total: outcome.total };
};

/** Signed links last about an hour; refetch before retrying when one is close to expiring or past it. */
export const isExpired = (photo: DownloadablePhoto, now = new Date()): boolean => {
  if (!photo.expires_at) {
    return false;
  }
  const expires = new Date(photo.expires_at).getTime();
  return !Number.isNaN(expires) && expires - now.getTime() < 60_000;
};

/** Photo ids chosen in selection mode, in gallery order. */
export const photosForSelection = (photos: DownloadablePhoto[], selectedIds: ReadonlySet<number>) =>
  photos.filter((photo) => selectedIds.has(photo.id));

export type PermissionState = 'granted' | 'denied' | 'undetermined';
