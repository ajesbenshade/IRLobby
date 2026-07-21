import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

import { config } from '@constants/config';

export type AnalyticsEvent =
  | 'app_open'
  | 'sign_up'
  | 'login'
  | 'onboarding_completed'
  | 'activity_swipe_right'
  | 'activity_join'
  | 'activity_create'
  | 'first_join';

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

const FIRST_OPEN_KEY = '@irlobby/analytics/first_open_tracked';
const FIRST_JOIN_KEY = '@irlobby/analytics/first_join_tracked';

let initialized = false;

const getSentryDsn = (): string | undefined => {
  const fromExtra = (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn;
  const fromEnv = process.env.EXPO_PUBLIC_SENTRY_DSN;
  return (fromExtra || fromEnv || '').trim() || undefined;
};

const getEnvironment = (): string => {
  if (__DEV__) {
    return 'development';
  }
  return process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() || 'production';
};

export const initAnalytics = (): void => {
  if (initialized) {
    return;
  }
  initialized = true;

  const dsn = getSentryDsn();
  if (!dsn) {
    if (__DEV__) {
      console.info('[analytics] Sentry DSN not configured; funnel events will log locally only.');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: getEnvironment(),
    enableAutoSessionTracking: true,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    sendDefaultPii: false,
  });
};

export const setAnalyticsUser = (
  user: { id: string | number; email?: string | null } | null,
): void => {
  if (!getSentryDsn()) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: String(user.id),
    email: user.email ?? undefined,
  });
};

export const track = (event: AnalyticsEvent, props: AnalyticsProps = {}): void => {
  const cleanedEntries = Object.entries(props).filter(([, value]) => value !== undefined);
  const cleaned = Object.fromEntries(cleanedEntries) as Record<string, string | number | boolean | null>;

  if (__DEV__) {
    console.info('[analytics]', event, cleaned);
  }

  if (!getSentryDsn()) {
    return;
  }

  Sentry.addBreadcrumb({
    category: 'analytics',
    message: event,
    level: 'info',
    data: cleaned,
  });

  try {
    const metrics = (Sentry as { metrics?: { count?: Function } }).metrics;
    metrics?.count?.(`funnel.${event}`, 1, {
      attributes: Object.fromEntries(
        Object.entries(cleaned).map(([key, value]) => [key, value == null ? 'null' : String(value)]),
      ),
    });
  } catch (error) {
    console.warn('[analytics] Failed to emit metric', error);
  }
};

export const trackAppOpen = async (): Promise<void> => {
  track('app_open', {
    apiBaseUrlSource: config.apiBaseUrlSource,
  });

  try {
    const alreadyTracked = await AsyncStorage.getItem(FIRST_OPEN_KEY);
    if (!alreadyTracked) {
      await AsyncStorage.setItem(FIRST_OPEN_KEY, '1');
      track('app_open', { first_open: true });
    }
  } catch (error) {
    console.warn('[analytics] Failed to persist first open', error);
  }
};

export const trackFirstJoinOnce = async (props: AnalyticsProps = {}): Promise<void> => {
  track('activity_join', props);

  try {
    const alreadyTracked = await AsyncStorage.getItem(FIRST_JOIN_KEY);
    if (alreadyTracked) {
      return;
    }
    await AsyncStorage.setItem(FIRST_JOIN_KEY, '1');
    track('first_join', props);
  } catch (error) {
    console.warn('[analytics] Failed to persist first join', error);
  }
};

export const AnalyticsErrorBoundary = Sentry.ErrorBoundary;
export const wrapWithAnalytics = Sentry.wrap;