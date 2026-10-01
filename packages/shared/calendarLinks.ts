export type CalendarLinks = {
  ics_url?: string | null;
  webcal_url?: string | null;
  google_url?: string | null;
  outlook_url?: string | null;
};

export type CalendarLinkActivity = {
  calendar_links?: CalendarLinks | null;
};

/**
 * Public church feed. Subscribe uses the webcal form; Copy link uses the https form.
 * Gathering rows still come from activity.calendar_links.
 */
export const CHURCH_CALENDAR_ICS_PATH = '/api/public/calendar.ics';

const linkValue = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const calendarLinksFromActivity = (activity: CalendarLinkActivity) => {
  const links = activity.calendar_links;
  return {
    google: linkValue(links?.google_url),
    outlook: linkValue(links?.outlook_url),
    apple: linkValue(links?.ics_url) ?? linkValue(links?.webcal_url),
  };
};

const summaryPart = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  parts.find((part) => part.type === type)?.value ?? '';

/** One line under the sheet title: "Women's Fall Brunch · Sat, Oct 17 · 9:30 AM". */
export const calendarEventSummary = (title: string, startsAt?: string | null) => {
  const name = title.trim() || 'Gathering';
  if (!startsAt) {
    return name;
  }
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    return name;
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  }).formatToParts(date);
  const clock = `${summaryPart(parts, 'hour')}:${summaryPart(parts, 'minute')} ${summaryPart(parts, 'dayPeriod')}`;
  return `${name} · ${summaryPart(parts, 'weekday')}, ${summaryPart(parts, 'month')} ${summaryPart(parts, 'day')} · ${clock}`;
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

export const churchCalendarFeedUrl = (apiBaseUrl: string, pageOrigin?: string): string =>
  `${absoluteHttpBase(apiBaseUrl, pageOrigin)}${CHURCH_CALENDAR_ICS_PATH}`;

export const churchCalendarSubscribeUrl = (apiBaseUrl: string, pageOrigin?: string): string =>
  churchCalendarFeedUrl(apiBaseUrl, pageOrigin).replace(/^https?:\/\//i, 'webcal://');
