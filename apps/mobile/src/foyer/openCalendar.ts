import { Linking } from 'react-native';

import { config } from '@constants/config';
import {
  appleEventIcsUrl,
  churchCalendarSubscribeUrl,
  googleCalendarUrl,
  outlookCalendarUrl,
} from '@shared/calendarLinks';

export type CalendarGathering = {
  id: string | number;
  title: string;
  description?: string | null;
  location?: string | null;
  time?: string | null;
  end_time?: string | null;
  endTime?: string | null;
};

export const gatheringCalendarUrls = (activity: CalendarGathering) => {
  const event = {
    title: activity.title,
    start: activity.time,
    end: activity.end_time ?? activity.endTime ?? null,
    location: activity.location,
    description: activity.description,
  };
  return {
    google: googleCalendarUrl(event),
    outlook: outlookCalendarUrl(event),
    apple: appleEventIcsUrl(config.apiBaseUrl, activity.id),
  };
};

export const openCalendarUrl = (url: string) => {
  void Linking.openURL(url).catch(() => undefined);
};

export const openChurchCalendarSubscription = () => {
  openCalendarUrl(churchCalendarSubscribeUrl(config.apiBaseUrl));
};
