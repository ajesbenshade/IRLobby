import { isExpired, photosForSelection, runPhotoDownloads, toastForOutcome } from '../downloads';

const photo = (id: number) => ({ id, filename: `p${id}.jpg`, url: `https://x/${id}` });

describe('photo downloads', () => {
  it('saves every photo one at a time and reports progress', async () => {
    const saved: string[] = [];
    const progress: Array<[number, number]> = [];
    const outcome = await runPhotoDownloads([photo(1), photo(2), photo(3)], {
      download: async (item) => `file://${item.id}`,
      save: async (uri) => {
        saved.push(uri);
      },
      isCancelled: () => false,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(saved).toEqual(['file://1', 'file://2', 'file://3']);
    expect(progress[progress.length - 1]).toEqual([3, 3]);
    expect(toastForOutcome(outcome)).toEqual({ kind: 'saved', saved: 3 });
  });

  it('cancel keeps what was saved and Retry continues with the rest', async () => {
    let cancelled = false;
    const outcome = await runPhotoDownloads([photo(1), photo(2), photo(3)], {
      download: async (item) => `file://${item.id}`,
      save: async () => {
        cancelled = true;
      },
      isCancelled: () => cancelled,
    });
    expect(outcome.cancelled).toBe(true);
    expect(outcome.saved).toBe(1);
    expect(outcome.remaining.map((item) => item.id)).toEqual([2, 3]);
    expect(toastForOutcome(outcome)).toEqual({ kind: 'cancelled', saved: 1, total: 3 });

    const retry = await runPhotoDownloads(
      outcome.remaining,
      { download: async (item) => `file://${item.id}`, save: async () => undefined, isCancelled: () => false },
      outcome.saved,
      outcome.total,
    );
    expect(retry.saved).toBe(3);
    expect(toastForOutcome(retry)).toEqual({ kind: 'saved', saved: 3 });
  });

  it('a failed photo does not stop the rest, and Retry only has the failed ones', async () => {
    const outcome = await runPhotoDownloads([photo(1), photo(2), photo(3)], {
      download: async (item) => {
        if (item.id === 2) {
          throw new Error('network');
        }
        return `file://${item.id}`;
      },
      save: async () => undefined,
      isCancelled: () => false,
    });
    expect(outcome.saved).toBe(2);
    expect(outcome.failedIds).toEqual([2]);
    expect(outcome.remaining.map((item) => item.id)).toEqual([2]);
    expect(toastForOutcome(outcome)).toEqual({ kind: 'partial', saved: 2, total: 3 });
  });

  it('reports a full failure when nothing could be saved', async () => {
    const outcome = await runPhotoDownloads([photo(1)], {
      download: async () => {
        throw new Error('x');
      },
      save: async () => undefined,
      isCancelled: () => false,
    });
    expect(toastForOutcome(outcome)).toEqual({ kind: 'failed' });
  });

  it('selection mode and link expiry', () => {
    expect(photosForSelection([photo(1), photo(2), photo(3)], new Set([2, 3])).map((item) => item.id)).toEqual([2, 3]);
    const now = new Date('2026-10-17T12:00:00Z');
    expect(isExpired({ ...photo(1), expires_at: '2026-10-17T12:00:30Z' }, now)).toBe(true);
    expect(isExpired({ ...photo(1), expires_at: '2026-10-17T13:00:00Z' }, now)).toBe(false);
  });
});
