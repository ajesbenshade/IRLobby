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

const apiBaseUrl = configuredApiBaseUrl || (import.meta.env.DEV ? DEFAULT_DEV_API_BASE_URL : DEFAULT_PROD_API_BASE_URL);

const configuredWebsocketUrl =
  normalizeValue(import.meta.env.VITE_WEBSOCKET_URL as string | undefined) ||
  normalizeValue(import.meta.env.EXPO_PUBLIC_WEBSOCKET_URL as string | undefined);

const websocketUrl =
  configuredWebsocketUrl ||
  removeTrailingSlash(
    apiBaseUrl.replace(/^https?:\/\//, (prefix) =>
      prefix === 'https://' ? 'wss://' : 'ws://',
    ),
  );

export const config = {
  apiBaseUrl,
  websocketUrl,
};
