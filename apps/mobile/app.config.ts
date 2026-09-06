import type { ConfigContext, ExpoConfig } from 'expo/config';

const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || '';
const googleReversedClientIdScheme = googleIosClientId.endsWith('.apps.googleusercontent.com')
  ? googleIosClientId.split('.').reverse().join('.')
  : undefined;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'IRLobby',
  slug: 'irlobby',
  version: '1.0.0',
  description: 'IRLobby — Get out. Get together. Real plans nearby.',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: googleReversedClientIdScheme ? ['irlobby', googleReversedClientIdScheme] : 'irlobby',
  userInterfaceStyle: 'automatic',
  primaryColor: '#5B4BFF',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0A0814',
    dark: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0814',
    },
  },
  updates: {
    url: process.env.EAS_UPDATE_URL,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    websocketUrl: process.env.EXPO_PUBLIC_WEBSOCKET_URL,
    twitterClientId: process.env.EXPO_PUBLIC_TWITTER_CLIENT_ID,
    twitterRedirectUri: process.env.EXPO_PUBLIC_TWITTER_REDIRECT_URI,
    googleExpoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    mapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '',
    eas: {
      projectId: '9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe',
    },
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.irlobby.app',
    usesAppleSignIn: true,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSCameraUsageDescription:
        'IRLobby needs access to your camera to capture photos for activities and profile updates.',
      NSLocationWhenInUseUsageDescription:
        'IRLobby uses your location to show relevant nearby activities.',
      NSPhotoLibraryUsageDescription:
        'IRLobby needs access to your photo library to upload activity images.',
    },
  },
  android: {
    package: 'com.irlobby.app',
    // versionCode is managed remotely by EAS (`appVersionSource: "remote"` in eas.json)
    // with `autoIncrement: true` on the production build profile.
    permissions: [
      'CAMERA',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'VIBRATE',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0A0814',
    },
  },
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#5B4BFF',
      },
    ],
    'expo-font',
    'expo-location',
    [
      'expo-secure-store',
      {
        configureAndroidBackup: true,
      },
    ],
    'expo-web-browser',
    'expo-apple-authentication',
    [
      // Required for Google Play targetSdkVersion 36 (Android 16) compliance.
      // Enforcement deadline: 2026-08-31 for new app updates.
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: '36.0.0',
        },
      },
    ],
  ],
});
