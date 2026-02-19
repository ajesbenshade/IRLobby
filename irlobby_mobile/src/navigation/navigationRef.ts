import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

import type { RootStackParamList } from '@navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type PushData = Record<string, unknown> & {
  type?: string;
  matchId?: number;
  conversationId?: number;
};

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
      ? Number(value)
      : undefined;

export const handlePushNavigation = (data: unknown): boolean => {
  if (!navigationRef.isReady()) {
    return false;
  }

  const payload = (data ?? {}) as PushData;
  const type = typeof payload.type === 'string' ? payload.type : undefined;
  const matchId = getNumber(payload.matchId);
  const conversationId = getNumber(payload.conversationId);

  const currentRoute = navigationRef.getCurrentRoute();
  if (type === 'new_message' && currentRoute?.name === 'Chat') {
    const params = (currentRoute.params ?? {}) as { conversationId?: number; matchId?: number };
    if (conversationId != null && params.conversationId === conversationId) {
      return true;
    }
    if (conversationId == null && matchId != null && params.matchId === matchId) {
      return true;
    }
  }

  if (type === 'new_message' && (conversationId != null || matchId != null)) {
    navigationRef.dispatch(
      CommonActions.navigate('Main', {
        screen: 'Chat',
        params:
          conversationId != null
            ? { conversationId, matchId }
            : matchId != null
              ? { matchId }
              : undefined,
      }),
    );
    return true;
  }

  if (type === 'new_match') {
    navigationRef.dispatch(
      CommonActions.navigate('Main', {
        screen: 'Tabs',
        params: { screen: 'Matches' },
      }),
    );
    return true;
  }

  return false;
};
