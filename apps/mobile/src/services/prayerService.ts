import axios from 'axios';

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

import { api } from './apiClient';

export type PrayerListResult = {
  items: PrayerRequest[];
  unavailable: boolean;
};

const statusOf = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined;

const messageOf = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) return fallback;
  const data = error.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  const record = data as Record<string, unknown>;
  if (typeof record.detail === 'string' && record.detail.trim()) return record.detail;
  if (typeof record.error === 'string' && record.error.trim()) return record.error;
  for (const entry of Object.values(record)) {
    if (Array.isArray(entry) && typeof entry[0] === 'string' && entry[0].trim()) return entry[0];
  }
  return fallback;
};

const raise = (error: unknown, fallback: string): never => {
  throw new PrayerClientError(messageOf(error, fallback), statusOf(error));
};

/**
 * Thin prayer client. Endpoints are the contract in `@shared/prayer`.
 * A missing route returns an empty list (`unavailable`) so screens can render
 * an empty state until Backend ships the API. Mutations surface a normal error.
 */
export const fetchPrayerRequests = async (scope: PrayerScope): Promise<PrayerListResult> => {
  try {
    const response = await api.get(prayerPaths.list(scope));
    return { items: normalizePrayerList(response.data), unavailable: false };
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) return { items: [], unavailable: true };
    return raise(error, PRAYER_COPY.loadFailed);
  }
};

export const fetchPrayerRequest = async (id: number | string): Promise<PrayerRequest> => {
  try {
    const response = await api.get(prayerPaths.detail(id));
    const prayer = normalizePrayer(response.data);
    if (!prayer) throw new PrayerClientError(PRAYER_COPY.loadFailed);
    return prayer;
  } catch (error) {
    if (error instanceof PrayerClientError) throw error;
    return raise(error, PRAYER_COPY.loadFailed);
  }
};

export const createPrayerRequest = async (payload: PrayerCreatePayload): Promise<PrayerRequest> => {
  try {
    const response = await api.post(prayerPaths.create(), payload);
    const prayer = normalizePrayer(response.data);
    if (!prayer) throw new PrayerClientError(PRAYER_COPY.postFailed);
    return prayer;
  } catch (error) {
    if (error instanceof PrayerClientError) throw error;
    return raise(error, PRAYER_COPY.postFailed);
  }
};

export const prayForRequest = async (id: number | string): Promise<PrayerRequest | null> => {
  try {
    const response = await api.post(prayerPaths.pray(id), {});
    return normalizePrayer(response.data);
  } catch (error) {
    return raise(error, PRAYER_COPY.prayFailed);
  }
};

export const stopPraying = async (id: number | string): Promise<PrayerRequest | null> => {
  try {
    const response = await api.post(prayerPaths.stop(id), {});
    return normalizePrayer(response.data);
  } catch (error) {
    return raise(error, PRAYER_COPY.stopFailed);
  }
};

/** Pass only skips the card. A missing pass route is a local skip, not an error. */
export const passPrayerRequest = async (id: number | string): Promise<void> => {
  try {
    await api.post(prayerPaths.pass(id), {});
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) return;
    return raise(error, PRAYER_COPY.prayFailed);
  }
};

export const fetchPrayerChat = async (id: number | string): Promise<PrayerChat> => {
  try {
    const response = await api.get(prayerPaths.chat(id));
    return normalizePrayerChat(response.data);
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) {
      return { conversationId: null, label: 'Prayer chat', prayingFor: '', prayingCount: 0, messages: [] };
    }
    return raise(error, PRAYER_COPY.loadFailed);
  }
};

export const sendPrayerMessage = async (id: number | string, message: string): Promise<void> => {
  try {
    await api.post(prayerPaths.chat(id), { message });
  } catch (error) {
    return raise(error, PRAYER_COPY.sendFailed);
  }
};

export const reportPrayerRequest = async (id: number | string): Promise<'sent' | 'unavailable'> => {
  try {
    await api.post(prayerPaths.report(id), { reason: 'other' });
    return 'sent';
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) return 'unavailable';
    return raise(error, PRAYER_COPY.reportUnavailable);
  }
};

/** Joined circles only. Pending, invited, and open join are not a way onto a prayer. */
export const fetchPrayerCircles = async (): Promise<{ circles: PrayerCircle[]; unavailable: boolean }> => {
  try {
    const response = await api.get(prayerPaths.circles());
    return { circles: pickerCircles(normalizeCircles(response.data)), unavailable: false };
  } catch (error) {
    if (isMissingPrayerStatus(statusOf(error))) return { circles: [], unavailable: true };
    return raise(error, PRAYER_COPY.circlesFailed);
  }
};
