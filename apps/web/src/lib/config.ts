import { resolveClientConfig } from './configResolution';

const resolvedConfig = resolveClientConfig(
  import.meta.env,
  typeof window === 'undefined' ? undefined : window.location,
);

const shouldLogConfig =
  import.meta.env.DEV ||
  import.meta.env.VITE_LOG_CONFIG === 'true' ||
  (import.meta.env.PROD && resolvedConfig.diagnostics.usingRelativeApiBaseUrl);

if (shouldLogConfig) {
  console.info('IRLobby web config', resolvedConfig.diagnostics);
}

export const config = {
  apiBaseUrl: resolvedConfig.apiBaseUrl,
  websocketUrl: resolvedConfig.websocketUrl,
};

export const configDiagnostics = resolvedConfig.diagnostics;
