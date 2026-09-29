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
 * Stub until FOYER_API_CONTRACT.md records the church feed.
 * Backend confirmed the subscribe link is the webcal:// form of this path.
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

export const churchCalendarSubscribeUrl = (apiBaseUrl: string, pageOrigin?: string): string => {
  const https = absoluteHttpBase(apiBaseUrl, pageOrigin);
  return `${https.replace(/^https?:\/\//i, 'webcal://')}${CHURCH_CALENDAR_ICS_PATH}`;
};
