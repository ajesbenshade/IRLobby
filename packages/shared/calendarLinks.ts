export type CalendarEventInput = {
  title: string;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  description?: string | null;
};

/**
 * Per-gathering Apple Calendar file.
 * PR #27's contract publishes the church feed at `/api/public/calendar.ics`
 * and does not name a per-event file yet. Change this path in one place when it does.
 */
export const APPLE_EVENT_ICS_PATH = '/api/activities/{id}/calendar.ics';

export const CHURCH_CALENDAR_ICS_PATH = '/api/public/calendar.ics';

const GOOGLE_CALENDAR_URL = 'https://calendar.google.com/calendar/render';
const OUTLOOK_CALENDAR_URL = 'https://outlook.live.com/calendar/0/deeplink/compose';

const compactUtc = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

const outlookUtc = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

const parseInstant = (value: string | null | undefined): Date | null => {
  if (!value?.trim()) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const eventRange = (event: CalendarEventInput): { start: Date; end: Date } | null => {
  const start = parseInstant(event.start);
  if (!start) {
    return null;
  }
  const providedEnd = parseInstant(event.end);
  const end = providedEnd && providedEnd.getTime() > start.getTime()
    ? providedEnd
    : new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
};

export const googleCalendarUrl = (event: CalendarEventInput): string => {
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title });
  const range = eventRange(event);
  if (range) {
    params.set('dates', `${compactUtc(range.start)}/${compactUtc(range.end)}`);
  }
  if (event.description?.trim()) {
    params.set('details', event.description.trim());
  }
  if (event.location?.trim()) {
    params.set('location', event.location.trim());
  }
  return `${GOOGLE_CALENDAR_URL}?${params.toString()}`;
};

export const outlookCalendarUrl = (event: CalendarEventInput): string => {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
  });
  const range = eventRange(event);
  if (range) {
    params.set('startdt', outlookUtc(range.start));
    params.set('enddt', outlookUtc(range.end));
  }
  if (event.description?.trim()) {
    params.set('body', event.description.trim());
  }
  if (event.location?.trim()) {
    params.set('location', event.location.trim());
  }
  return `${OUTLOOK_CALENDAR_URL}?${params.toString()}`;
};

const absoluteHttpBase = (apiBaseUrl: string, pageOrigin?: string) => {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const origin = (pageOrigin ?? 'https://api.irlobby.com').replace(/\/+$/, '');
  if (!trimmed) {
    return origin;
  }
  return `${origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
};

export const appleEventIcsUrl = (
  apiBaseUrl: string,
  activityId: string | number,
  pageOrigin?: string,
): string => {
  const base = absoluteHttpBase(apiBaseUrl, pageOrigin);
  return `${base}${APPLE_EVENT_ICS_PATH.replace('{id}', encodeURIComponent(String(activityId)))}`;
};

export const churchCalendarSubscribeUrl = (apiBaseUrl: string, pageOrigin?: string): string => {
  const https = absoluteHttpBase(apiBaseUrl, pageOrigin);
  return `${https.replace(/^https?:\/\//i, 'webcal://')}${CHURCH_CALENDAR_ICS_PATH}`;
};
