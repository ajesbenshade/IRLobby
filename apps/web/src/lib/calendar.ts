import { config } from '@/lib/config';
import { calendarLinksFromActivity, churchCalendarSubscribeUrl, type CalendarLinkActivity } from '@shared/calendarLinks';

export const gatheringCalendarUrls = (activity: CalendarLinkActivity) => calendarLinksFromActivity(activity);

export const churchSubscribeUrl = () =>
  churchCalendarSubscribeUrl(config.apiBaseUrl, typeof window === 'undefined' ? undefined : window.location.origin);

export const openCalendarUrl = (url: string | null) => {
  if (!url) {
    return;
  }
  if (url.startsWith('webcal:')) {
    window.location.assign(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};
