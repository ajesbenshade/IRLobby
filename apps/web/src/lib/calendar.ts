import { config } from '@/lib/config';
import {
  appleEventIcsUrl,
  churchCalendarSubscribeUrl,
  googleCalendarUrl,
  outlookCalendarUrl,
  type CalendarEventInput,
} from '@shared/calendarLinks';

export type WebGathering = CalendarEventInput & {
  id: string | number;
  time?: string | null;
  end_time?: string | null;
  endTime?: string | null;
};

export const gatheringCalendarUrls = (activity: WebGathering) => {
  const event: CalendarEventInput = {
    title: activity.title,
    start: activity.start ?? activity.time,
    end: activity.end ?? activity.end_time ?? activity.endTime,
    location: activity.location,
    description: activity.description,
  };
  const origin = typeof window === 'undefined' ? undefined : window.location.origin;
  return {
    google: googleCalendarUrl(event),
    outlook: outlookCalendarUrl(event),
    apple: appleEventIcsUrl(config.apiBaseUrl, activity.id, origin),
  };
};

export const churchSubscribeUrl = () =>
  churchCalendarSubscribeUrl(config.apiBaseUrl, typeof window === 'undefined' ? undefined : window.location.origin);

export const openCalendarUrl = (url: string) => {
  if (url.startsWith('webcal:')) {
    window.location.assign(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};
