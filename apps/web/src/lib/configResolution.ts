const DEFAULT_API_BASE_URL = '';

export interface ClientEnv {
  DEV?: boolean;
  PROD?: boolean;
  VITE_API_BASE_URL?: string;
  EXPO_PUBLIC_API_BASE_URL?: string;
  VITE_WEBSOCKET_BASE_URL?: string;
  VITE_WEBSOCKET_URL?: string;
  EXPO_PUBLIC_WEBSOCKET_URL?: string;
  VITE_LOG_CONFIG?: string;
}

export interface BrowserLocationLike {
  protocol: string;
  host: string;
}

export interface ClientConfigResolution {
  apiBaseUrl: string;
  websocketUrl: string;
  diagnostics: {
    apiBaseUrlSource: 'vite' | 'expo' | 'relative-fallback';
    websocketUrlSource: 'vite' | 'expo' | 'derived';
    hasViteApiBaseUrl: boolean;
    hasExpoApiBaseUrl: boolean;
    hasViteWebsocketUrl: boolean;
    hasViteWebsocketBaseUrl: boolean;
    hasExpoWebsocketUrl: boolean;
    usingRelativeApiBaseUrl: boolean;
    isProduction: boolean;
  };
}

const removeTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const normalizeValue = (value: string | undefined) => {
  const cleaned = value?.trim();
  return cleaned ? removeTrailingSlash(cleaned) : undefined;
};

const deriveWebsocketUrl = (baseUrl: string, location?: BrowserLocationLike) => {
  if (baseUrl) {
    return removeTrailingSlash(
      baseUrl.replace(/^https?:\/\//, (prefix) =>
        prefix === 'https://' ? 'wss://' : 'ws://',
      ),
    );
  }

  if (!location) {
    return '';
  }

  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
};

export function resolveClientConfig(
  env: ClientEnv,
  location?: BrowserLocationLike,
): ClientConfigResolution {
  const viteApiBaseUrl = normalizeValue(env.VITE_API_BASE_URL);
  const expoApiBaseUrl = normalizeValue(env.EXPO_PUBLIC_API_BASE_URL);
  const apiBaseUrl = viteApiBaseUrl ?? expoApiBaseUrl ?? DEFAULT_API_BASE_URL;
  const apiBaseUrlSource = viteApiBaseUrl ? 'vite' : expoApiBaseUrl ? 'expo' : 'relative-fallback';

  const viteWebsocketBaseUrl = normalizeValue(env.VITE_WEBSOCKET_BASE_URL);
  const viteWebsocketUrl = normalizeValue(env.VITE_WEBSOCKET_URL);
  const expoWebsocketUrl = normalizeValue(env.EXPO_PUBLIC_WEBSOCKET_URL);
  const websocketUrl =
    viteWebsocketBaseUrl ?? viteWebsocketUrl ?? expoWebsocketUrl ?? deriveWebsocketUrl(apiBaseUrl, location);
  const websocketUrlSource =
    viteWebsocketBaseUrl || viteWebsocketUrl ? 'vite' : expoWebsocketUrl ? 'expo' : 'derived';

  return {
    apiBaseUrl,
    websocketUrl,
    diagnostics: {
      apiBaseUrlSource,
      websocketUrlSource,
      hasViteApiBaseUrl: Boolean(viteApiBaseUrl),
      hasExpoApiBaseUrl: Boolean(expoApiBaseUrl),
      hasViteWebsocketUrl: Boolean(viteWebsocketBaseUrl || viteWebsocketUrl),
      hasViteWebsocketBaseUrl: Boolean(viteWebsocketBaseUrl),
      hasExpoWebsocketUrl: Boolean(expoWebsocketUrl),
      usingRelativeApiBaseUrl: apiBaseUrl === DEFAULT_API_BASE_URL,
      isProduction: env.PROD === true,
    },
  };
}