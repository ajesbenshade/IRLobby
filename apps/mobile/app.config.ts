import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'IRLobby',
  slug: 'irlobby',
  version: '1.0.0',
  description: 'IRLobby — Get out. Get together. Real plans nearby.',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'irlobby',
  userInterfaceStyle: 'automatic',
  primaryColor: '#7C3AED',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#7C3AED',
    dark: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0F172A',
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
    mapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN,
    eas: {
      projectId: '9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe',
    },
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.irlobby.app',
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
      backgroundColor: '#7C3AED',
    },
  },
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#7C3AED',
      },
    ],
    'expo-font',
    'expo-location',
    'expo-secure-store',
    'expo-web-browser',
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
