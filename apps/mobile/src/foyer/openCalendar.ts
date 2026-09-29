import { Linking } from 'react-native';

import { config } from '@constants/config';
import { calendarLinksFromActivity, churchCalendarSubscribeUrl, type CalendarLinkActivity } from '@shared/calendarLinks';

export const gatheringCalendarUrls = (activity: CalendarLinkActivity) => calendarLinksFromActivity(activity);

export const openCalendarUrl = (url: string | null) => {
  if (!url) {
    return;
  }
  void Linking.openURL(url).catch(() => undefined);
};

export const openChurchCalendarSubscription = () => {
  openCalendarUrl(churchCalendarSubscribeUrl(config.apiBaseUrl));
};
