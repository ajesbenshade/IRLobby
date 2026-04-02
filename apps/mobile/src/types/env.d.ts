declare module 'react-native-dotenv';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_BASE_URL?: string;
      EXPO_PUBLIC_WEBSOCKET_URL?: string;
      EXPO_PUBLIC_TWITTER_CLIENT_ID?: string;
      EXPO_PUBLIC_TWITTER_REDIRECT_URI?: string;
      EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN?: string;
      EAS_PROJECT_ID?: string;
    }
  }
}

export {};
