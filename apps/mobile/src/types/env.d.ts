declare module 'react-native-dotenv';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_BASE_URL?: string;
      EXPO_PUBLIC_WEBSOCKET_URL?: string;
      EXPO_PUBLIC_TWITTER_CLIENT_ID?: string;
      EXPO_PUBLIC_TWITTER_REDIRECT_URI?: string;
      EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN?: string;
      EXPO_PUBLIC_GOOGLE_CLIENT_ID?: string;
      EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID?: string;
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?: string;
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
      EXPO_PUBLIC_SENTRY_DSN?: string;
      EAS_PROJECT_ID?: string;
    }
  }
}

export {};
