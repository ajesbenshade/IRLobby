import Constants from 'expo-constants';

const extra =
  Constants.expoConfig?.extra ??
  // @ts-ignore Expo SDK < 49 compatibility
  Constants.manifest?.extra ??
  {};

const removeTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const DEFAULT_DEV_API_BASE_URL = 'http://localhost:8000';
const DEFAULT_PROD_API_BASE_URL = 'https://liyf.app';

const normalizeApiBaseUrl = (value: string | undefined) => {
  const cleanedValue = value?.trim();

  if (!cleanedValue) {
    return __DEV__ ? DEFAULT_DEV_API_BASE_URL : DEFAULT_PROD_API_BASE_URL;
  }

  return removeTrailingSlash(cleanedValue);
};

const deriveWebsocketUrl = (apiBaseUrl: string) => {
  const wsProtocol = apiBaseUrl.startsWith('https://') ? 'wss://' : 'ws://';
  return apiBaseUrl.replace(/^https?:\/\//, wsProtocol);
};

const apiBaseUrl = normalizeApiBaseUrl(extra.apiBaseUrl as string | undefined);
const configuredWebsocketUrl = extra.websocketUrl as string | undefined;
const configuredApiBaseUrl = (extra.apiBaseUrl as string | undefined)?.trim();
const isUsingFallbackApiBaseUrl = !configuredApiBaseUrl;

export const config = {
  apiBaseUrl,
  websocketUrl: configuredWebsocketUrl ? removeTrailingSlash(configuredWebsocketUrl) : deriveWebsocketUrl(apiBaseUrl),
  isUsingFallbackApiBaseUrl,
  apiBaseUrlSource: isUsingFallbackApiBaseUrl ? (__DEV__ ? 'fallback-dev' : 'fallback-production') : 'configured',
  twitterClientId: extra.twitterClientId as string | undefined,
  twitterRedirectUri: extra.twitterRedirectUri as string | undefined,
  googleMapsApiKey: extra.googleMapsApiKey as string | undefined,
};
