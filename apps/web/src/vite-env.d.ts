/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WEBSOCKET_BASE_URL: string;
  readonly VITE_WEBSOCKET_URL?: string;
  readonly VITE_LOG_CONFIG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
