import axios from 'axios';

import { HOST_LIMIT_COPY, PHOTO_LIMIT_COPY } from '@constants/foyerCopy';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `10:22 AM` in the phone's time zone. */
export const formatClock = (date: Date) => {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
};
/** `Sun, Oct 25 at 10:22 AM` (note above the tab bar), local time. */
export const formatHostDateShort = (date: Date) =>
  `${SHORT_DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()} at ${formatClock(date)}`;
/** `Sunday, Oct 25 at 10:22 AM` (weekly-limit sheet), local time. */
export const formatHostDateLong = (date: Date) =>
  `${LONG_DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()} at ${formatClock(date)}`;

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export type HostLimitState = { blocked: false } | { blocked: true; opensAt: Date };

/**
 * Members can host one gathering a week. Blocked only when the server sent a future `next_host_available_at`
 * and `event_limit_exempt` is not true (Backend PR #49). Missing, null or unreadable values never block.
 */
export const hostLimitState = (
  user: { eventLimitExempt?: boolean; nextHostAvailableAt?: string | null } | null | undefined,
  now: Date = new Date(),
): HostLimitState => {
  if (!user || user.eventLimitExempt) {
    return { blocked: false };
  }
  const opensAt = parseDate(user.nextHostAvailableAt);
  if (!opensAt || opensAt.getTime() <= now.getTime()) {
    return { blocked: false };
  }
  return { blocked: true, opensAt };
};

export const hostLimitBanner = (opensAt: Date) => HOST_LIMIT_COPY.banner(formatHostDateShort(opensAt));

type ErrorBody = Record<string, unknown>;

const errorParts = (error: unknown): { status?: number; data: ErrorBody; headers: Record<string, unknown> } | null => {
  if (!axios.isAxiosError(error) || !error.response) {
    return null;
  }
  const data = error.response.data && typeof error.response.data === 'object' ? (error.response.data as ErrorBody) : {};
  return { status: error.response.status, data, headers: (error.response.headers ?? {}) as Record<string, unknown> };
};

/** Reads a response header from AxiosHeaders (`get`) or a plain object, case-insensitively. */
const headerValue = (headers: Record<string, unknown>, name: string): unknown => {
  const getter = (headers as { get?: (key: string) => unknown }).get;
  if (typeof getter === 'function') {
    const value = getter.call(headers, name);
    if (value != null) {
      return value;
    }
  }
  const key = Object.keys(headers).find((entry) => entry.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
};

const secondsFrom = (value: unknown, now: Date): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    const date = parseDate(value);
    if (date) {
      return Math.max(0, (date.getTime() - now.getTime()) / 1000);
    }
  }
  return null;
};

/**
 * 429 `{code: 'event_limit_reached', detail, limit, period, retry_after, next_allowed_at}` from create. The server
 * `detail` is ignored: the sheet uses Design's copy, dated from `next_allowed_at` in local time. Null otherwise.
 */
export const parseEventLimitError = (error: unknown, now: Date = new Date()): { nextAllowedAt: Date | null } | null => {
  const parts = errorParts(error);
  if (!parts || parts.status !== 429 || parts.data.code !== 'event_limit_reached') {
    return null;
  }
  const explicit = parseDate(parts.data.next_allowed_at);
  if (explicit) {
    return { nextAllowedAt: explicit };
  }
  const seconds = secondsFrom(parts.data.retry_after ?? headerValue(parts.headers, 'retry-after'), now);
  return { nextAllowedAt: seconds != null ? new Date(now.getTime() + seconds * 1000) : null };
};

export const eventLimitSheetBody = (nextAllowedAt: Date | null) =>
  nextAllowedAt ? HOST_LIMIT_COPY.sheetBody(formatHostDateLong(nextAllowedAt)) : HOST_LIMIT_COPY.sheetBodyNoDate;

export type PhotoLimitNotice = { title: string; body: string };

/** Uploads allowed per hour when the throttle response doesn't say (Backend PR #49). */
export const DEFAULT_PHOTOS_PER_HOUR = 30;
export const DEFAULT_PHOTO_CAP = 50;

/**
 * Sheet copy for the photo upload limits (frames 248-249), or null when the error is something else:
 * 429 `{code: 'throttled', retry_after}` (seconds, rounded up to whole minutes; Retry-After header as fallback)
 * and 400 `{code: 'event_photo_limit_reached', limit: 50}`.
 */
export const photoLimitNotice = (error: unknown, now: Date = new Date()): PhotoLimitNotice | null => {
  const parts = errorParts(error);
  if (!parts) {
    return null;
  }
  if (parts.status === 400 && parts.data.code === 'event_photo_limit_reached') {
    const limit = Number(parts.data.limit);
    return { title: PHOTO_LIMIT_COPY.fullTitle, body: PHOTO_LIMIT_COPY.full(Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_PHOTO_CAP) };
  }
  if (parts.status === 429 && (parts.data.code === 'throttled' || parts.data.code == null)) {
    const limit = Number(parts.data.limit);
    const perHour = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_PHOTOS_PER_HOUR;
    const seconds = secondsFrom(parts.data.retry_after ?? headerValue(parts.headers, 'retry-after'), now);
    return {
      title: PHOTO_LIMIT_COPY.throttledTitle,
      body:
        seconds == null
          ? PHOTO_LIMIT_COPY.throttledNoTime(perHour)
          : PHOTO_LIMIT_COPY.throttled(perHour, Math.max(1, Math.ceil(seconds / 60))),
    };
  }
  return null;
};
