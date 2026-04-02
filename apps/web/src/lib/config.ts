const DEFAULT_DEV_API_BASE_URL = 'http://localhost:8000';
const DEFAULT_PROD_API_BASE_URL = 'https://liyf.app';

const removeTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeValue = (value: string | undefined) => {
  const cleaned = value?.trim();
  return cleaned ? removeTrailingSlash(cleaned) : undefined;
};

const configuredApiBaseUrl =
  normalizeValue(import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  normalizeValue(import.meta.env.EXPO_PUBLIC_API_BASE_URL as string | undefined);

const getDefaultApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return DEFAULT_DEV_API_BASE_URL;
  }

  return DEFAULT_PROD_API_BASE_URL;
};

const apiBaseUrl = configuredApiBaseUrl || getDefaultApiBaseUrl();

const configuredWebsocketUrl =
  normalizeValue(import.meta.env.VITE_WEBSOCKET_URL as string | undefined) ||
  normalizeValue(import.meta.env.EXPO_PUBLIC_WEBSOCKET_URL as string | undefined);

const deriveWebsocketUrl = (baseUrl: string) => {
  if (baseUrl) {
    return removeTrailingSlash(
      baseUrl.replace(/^https?:\/\//, (prefix) =>
        prefix === 'https://' ? 'wss://' : 'ws://',
      ),
    );
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
  }

  return 'wss://liyf.app';
};

const websocketUrl = configuredWebsocketUrl || deriveWebsocketUrl(apiBaseUrl);

export const config = {
  apiBaseUrl,
  websocketUrl,
};
