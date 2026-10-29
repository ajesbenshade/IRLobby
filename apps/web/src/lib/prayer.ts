import { apiRequest } from '@/lib/queryClient';
import { pickerCircles } from '@shared/circles';
import {
  PRAYER_COPY,
  PrayerClientError,
  isMissingPrayerStatus,
  normalizeCircles,
  normalizePrayer,
  normalizePrayerChat,
  normalizePrayerList,
  prayerPaths,
  type PrayerChat,
  type PrayerCircle,
  type PrayerCreatePayload,
  type PrayerRequest,
  type PrayerScope,
} from '@shared/prayer';

export type PrayerListResult = {
  items: PrayerRequest[];
  unavailable: boolean;
};

const statusOf = (error: unknown): number | undefined => {
  if (typeof error === 'object' && error && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

const messageOf = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    const stripped = error.message.replace(/^\d+:\s*/, '').trim();
    if (stripped) return stripped;
  }
  return fallback;
};

const raise = (error: unknown, fallback: string): never => {
  throw new PrayerClientError(messageOf(error, fallback), statusOf(error));
};

const readBody = async (response: Response) => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
};

const request = async (method: 'GET' | 'POST', url: string, body?: unknown) => {
  const response = await apiRequest(method, url, body);
  return readBody(response);
};

/** Same contract as the native client. See `@shared/prayer`. */
export async function fetchPrayerRequests(scope: PrayerScope): Promise<PrayerListResult> {
  try {
    const data = await request('GET', prayerPaths.list(scope));
    return { items: normalizePrayerList(data), unavailable: false };
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) return { items: [], unavailable: true };
    return raise(error, PRAYER_COPY.loadFailed);
  }
}

export async function fetchPrayerRequest(id: number | string): Promise<PrayerRequest> {
  try {
    const prayer = normalizePrayer(await request('GET', prayerPaths.detail(id)));
    if (!prayer) throw new PrayerClientError(PRAYER_COPY.loadFailed);
    return prayer;
  } catch (error) {
    if (error instanceof PrayerClientError) throw error;
    return raise(error, PRAYER_COPY.loadFailed);
  }
}

export async function createPrayerRequest(payload: PrayerCreatePayload): Promise<PrayerRequest> {
  try {
    const prayer = normalizePrayer(await request('POST', prayerPaths.create(), payload));
    if (!prayer) throw new PrayerClientError(PRAYER_COPY.postFailed);
    return prayer;
  } catch (error) {
    if (error instanceof PrayerClientError) throw error;
    return raise(error, PRAYER_COPY.postFailed);
  }
}

export async function prayForRequest(id: number | string): Promise<PrayerRequest | null> {
  try {
    return normalizePrayer(await request('POST', prayerPaths.pray(id), {}));
  } catch (error) {
    return raise(error, PRAYER_COPY.prayFailed);
  }
}

export async function stopPraying(id: number | string): Promise<PrayerRequest | null> {
  try {
    return normalizePrayer(await request('POST', prayerPaths.stop(id), {}));
  } catch (error) {
    return raise(error, PRAYER_COPY.stopFailed);
  }
}

export async function passPrayerRequest(id: number | string): Promise<void> {
  try {
    await request('POST', prayerPaths.pass(id), {});
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) return;
    return raise(error, PRAYER_COPY.prayFailed);
  }
}

export async function fetchPrayerChat(id: number | string): Promise<PrayerChat> {
  try {
    return normalizePrayerChat(await request('GET', prayerPaths.chat(id)));
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) {
      return {
        conversationId: null,
        label: 'Prayer chat',
        prayingFor: '',
        prayingCount: 0,
        messages: [],
      };
    }
    return raise(error, PRAYER_COPY.loadFailed);
  }
}

export async function sendPrayerMessage(id: number | string, message: string): Promise<void> {
  try {
    await request('POST', prayerPaths.chat(id), { message });
  } catch (error) {
    return raise(error, PRAYER_COPY.sendFailed);
  }
}

export async function reportPrayerRequest(id: number | string): Promise<'sent' | 'unavailable'> {
  try {
    await request('POST', prayerPaths.report(id), { reason: 'other' });
    return 'sent';
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) return 'unavailable';
    return raise(error, PRAYER_COPY.reportUnavailable);
  }
}

/** Joined circles only. Pending, invited, and open join are not a way onto a prayer. */
export async function fetchPrayerCircles(): Promise<{
  circles: PrayerCircle[];
  unavailable: boolean;
}> {
  try {
    return {
      circles: pickerCircles(normalizeCircles(await request('GET', prayerPaths.circles()))),
      unavailable: false,
    };
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) return { circles: [], unavailable: true };
    return raise(error, PRAYER_COPY.circlesFailed);
  }
}
