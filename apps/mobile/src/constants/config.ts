import Constants from 'expo-constants';

const extra = (
  Constants.expoConfig?.extra ??
  // @ts-ignore Expo SDK < 49 compatibility
  Constants.manifest?.extra ??
  {}
) as Record<string, unknown>;

export const pickConfigString = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
};

const removeTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const DEFAULT_DEV_API_BASE_URL = 'http://localhost:8000';

const normalizeApiBaseUrl = (value: string | undefined) => {
  const cleanedValue = value?.trim();

  if (!cleanedValue) {
    if (__DEV__) return DEFAULT_DEV_API_BASE_URL;
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set');
  }

  return removeTrailingSlash(cleanedValue);
};

const deriveWebsocketUrl = (apiBaseUrl: string) => {
  const wsProtocol = apiBaseUrl.startsWith('https://') ? 'wss://' : 'ws://';
  return apiBaseUrl.replace(/^https?:\/\//, wsProtocol);
};

const apiBaseUrl = normalizeApiBaseUrl(
  pickConfigString(extra.apiBaseUrl, process.env.EXPO_PUBLIC_API_BASE_URL),
);
const configuredWebsocketUrl = pickConfigString(
  extra.websocketUrl,
  process.env.EXPO_PUBLIC_WEBSOCKET_URL,
);
const configuredApiBaseUrl = pickConfigString(
  extra.apiBaseUrl,
  process.env.EXPO_PUBLIC_API_BASE_URL,
);
const isUsingFallbackApiBaseUrl = !configuredApiBaseUrl;

export const config = {
  apiBaseUrl,
  websocketUrl: configuredWebsocketUrl ? removeTrailingSlash(configuredWebsocketUrl) : deriveWebsocketUrl(apiBaseUrl),
  isUsingFallbackApiBaseUrl,
  apiBaseUrlSource: isUsingFallbackApiBaseUrl ? (__DEV__ ? 'fallback-dev' : 'fallback-production') : 'configured',
  twitterClientId: pickConfigString(
    extra.twitterClientId,
    process.env.EXPO_PUBLIC_TWITTER_CLIENT_ID,
  ),
  twitterRedirectUri: pickConfigString(
    extra.twitterRedirectUri,
    process.env.EXPO_PUBLIC_TWITTER_REDIRECT_URI,
  ),
  googleExpoClientId: pickConfigString(
    extra.googleExpoClientId,
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
  ),
  googleIosClientId: pickConfigString(
    extra.googleIosClientId,
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  ),
  googleAndroidClientId: pickConfigString(
    extra.googleAndroidClientId,
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  ),
  googleWebClientId: pickConfigString(
    extra.googleWebClientId,
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    extra.googleExpoClientId,
    process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    extra.googleClientId,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  ),
  mapboxPublicToken: pickConfigString(
    extra.mapboxPublicToken,
    process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN,
  ),
  sentryDsn: pickConfigString(extra.sentryDsn, process.env.EXPO_PUBLIC_SENTRY_DSN),
};
