import {
  useNavigationContainerRef,
  type NavigationContainerRefWithCurrent,
} from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import type { RootStackParamList } from '@navigation/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PushData = {
  type?: string;
  screen?: string;
  conversationId?: number | string;
  matchId?: number | string;
  activityId?: number | string;
};

const navigateFromPushData = (
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>,
  data: PushData | undefined,
) => {
  if (!navigation.isReady() || !data) {
    return;
  }

  const screen = data.screen || data.type;
  if (screen === 'Chat' || screen === 'new_message' || screen === 'new_match') {
    navigation.navigate('Main', {
      screen: 'Tabs',
      params: { screen: 'Chat' },
    });
    return;
  }

  if (screen === 'Activity' || screen === 'activity_join') {
    navigation.navigate('Main', {
      screen: 'Tabs',
      params: { screen: 'Activity' },
    });
  }
};

export const usePushNotificationNavigation = (
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
) => {
  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as PushData | undefined;
      navigateFromPushData(navigationRef, data);
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) {
        return;
      }
      const data = response.notification.request.content.data as PushData | undefined;
      navigateFromPushData(navigationRef, data);
    });

    return () => {
      responseSubscription.remove();
    };
  }, [navigationRef]);
};

export { useNavigationContainerRef };
