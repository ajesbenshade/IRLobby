import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'IRLobby',
  slug: 'irlobby',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'irlobby',
  userInterfaceStyle: 'light',
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
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
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
    versionCode: 1,
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
      backgroundColor: '#FFFFFF',
    },
  },
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#2c7ef8',
      },
    ],
    'expo-location',
    'expo-secure-store',
    'expo-web-browser',
  ],
});
