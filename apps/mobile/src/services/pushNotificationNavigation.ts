import {
  useNavigationContainerRef,
  type NavigationContainerRefWithCurrent,
} from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { isFoyerMode } from '@constants/appMode';
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
  conversationId?: number | string | null;
  matchId?: number | string | null;
  activityId?: number | string | null;
};

/** Gathering chat -> that gathering's chat; friend (1:1) chat -> DirectChat; null when no ids to open. */
export const messagePushTarget = (data: PushData) => {
  if (data.activityId != null) {
    return {
      screen: 'GatheringChat' as const,
      params: {
        activityId: data.activityId,
        ...(data.conversationId != null ? { conversationId: data.conversationId } : {}),
      },
    };
  }
  if (data.conversationId != null) {
    return { screen: 'DirectChat' as const, params: { conversationId: data.conversationId } };
  }
  return null;
};

const DETAIL_PUSH_TYPES = new Set(['activity_cancelled', 'join_request_approved', 'join_request_declined']);

/**
 * Host cancel and Require approval pushes.
 *  - `activity_cancelled`, `join_request_approved`, `join_request_declined` -> that gathering's detail
 *  - `join_request` (screen `Requests`) -> the host's Requests deck for that gathering
 * Returns null for anything else so the existing routing is unchanged.
 */
export const activityPushTarget = (data: PushData) => {
  if (data.activityId == null) {
    return null;
  }
  if (data.type === 'join_request' || (data.screen === 'Requests' && data.type !== 'activity_cancelled')) {
    return { screen: 'Requests' as const, params: { activityId: data.activityId } };
  }
  if (data.type && DETAIL_PUSH_TYPES.has(data.type)) {
    return { screen: 'GatheringDetail' as const, params: { activityId: data.activityId } };
  }
  return null;
};

const navigateFromPushData = (
  navigation: NavigationContainerRefWithCurrent<RootStackParamList>,
  data: PushData | undefined,
) => {
  if (!navigation.isReady() || !data) {
    return;
  }

  const screen = data.screen || data.type;
  if (isFoyerMode()) {
    const target = activityPushTarget(data);
    if (target) {
      if (target.screen === 'Requests') {
        // Gathering underneath, so Back returns to it.
        navigation.navigate('Main', { screen: 'GatheringDetail', params: { activityId: target.params.activityId } });
      }
      navigation.navigate('Main', target as never);
      return;
    }
  }
  // The Foyer has no Chat tab: message pushes open that gathering's (or friend's) chat.
  if (isFoyerMode() && (screen === 'Chat' || screen === 'new_message')) {
    const target = messagePushTarget(data);
    if (target) {
      if (target.screen === 'GatheringChat') {
        // Gathering underneath, so Back returns to it.
        navigation.navigate('Main', {
          screen: 'GatheringDetail',
          params: { activityId: target.params.activityId },
        });
      }
      navigation.navigate('Main', target as never);
      return;
    }
  }

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
