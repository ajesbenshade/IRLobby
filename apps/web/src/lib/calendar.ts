import { config } from '@/lib/config';
import {
  calendarLinksFromActivity,
  churchCalendarFeedUrl,
  churchCalendarSubscribeUrl,
  type CalendarLinkActivity,
} from '@shared/calendarLinks';

export const gatheringCalendarUrls = (activity: CalendarLinkActivity) =>
  calendarLinksFromActivity(activity);

const pageOrigin = () => (typeof window === 'undefined' ? undefined : window.location.origin);

export const churchSubscribeUrl = () => churchCalendarSubscribeUrl(config.apiBaseUrl, pageOrigin());

export const churchCalendarHttpsUrl = () => churchCalendarFeedUrl(config.apiBaseUrl, pageOrigin());

export const copyChurchCalendarLink = async () => {
  await navigator.clipboard.writeText(churchCalendarHttpsUrl());
};

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
