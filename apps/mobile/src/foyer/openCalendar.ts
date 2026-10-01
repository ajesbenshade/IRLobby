import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';

import { config } from '@constants/config';
import {
  calendarLinksFromActivity,
  churchCalendarFeedUrl,
  churchCalendarSubscribeUrl,
  type CalendarLinkActivity,
} from '@shared/calendarLinks';

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

export const copyChurchCalendarLink = () => Clipboard.setStringAsync(churchCalendarFeedUrl(config.apiBaseUrl));
