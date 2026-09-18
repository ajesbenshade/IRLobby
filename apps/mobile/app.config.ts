import type { ConfigContext, ExpoConfig } from 'expo/config';

const readExpoPublic = (name: string) => process.env[name]?.trim() || undefined;

export const reverseGoogleIosClientIdScheme = (iosClientId?: string) => {
  const trimmed = iosClientId?.trim() || '';
  return trimmed.endsWith('.apps.googleusercontent.com')
    ? trimmed.split('.').reverse().join('.')
    : undefined;
};

/** Guideline 5.1.1(ii) — keep every NSLocation* string identical to this copy. */
export const IOS_LOCATION_WHEN_IN_USE_USAGE_DESCRIPTION =
  'IRLobby uses your location to show hangouts near you on Discover — for example, a rooftop hang a few miles away tonight.';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIosClientId = readExpoPublic('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') || '';
  const googleReversedClientIdScheme = reverseGoogleIosClientIdScheme(googleIosClientId);

  return {
  ...config,
  name: 'IRLobby',
  slug: 'irlobby',
  version: '1.0.0',
  description: 'IRLobby — Get out. Get together. Real plans nearby.',
  orientation: 'portrait',
  icon: './assets/AppIcon-1024.png',
  scheme: googleReversedClientIdScheme ? ['irlobby', googleReversedClientIdScheme] : 'irlobby',
  userInterfaceStyle: 'automatic',
  primaryColor: '#FF6B4A',
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
    twitterClientId: readExpoPublic('EXPO_PUBLIC_TWITTER_CLIENT_ID'),
    twitterRedirectUri: readExpoPublic('EXPO_PUBLIC_TWITTER_REDIRECT_URI'),
    googleExpoClientId: readExpoPublic('EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID'),
    googleClientId: readExpoPublic('EXPO_PUBLIC_GOOGLE_CLIENT_ID'),
    googleIosClientId: readExpoPublic('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
    googleAndroidClientId: readExpoPublic('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
    googleWebClientId: readExpoPublic('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
    mapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
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
        'IRLobby uses the camera to scan guest tickets at the door and to capture photos for activities and profile updates.',
      NSLocationWhenInUseUsageDescription: IOS_LOCATION_WHEN_IN_USE_USAGE_DESCRIPTION,
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
      foregroundImage: './assets/AppIcon-1024.png',
      backgroundColor: '#FF6B4A',
    },
  },
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/AppIcon-1024.png',
        color: '#FF6B4A',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'IRLobby uses the camera to scan guest tickets at the door and to capture photos for activities and profile updates.',
        recordAudioAndroid: false,
      },
    ],
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission: IOS_LOCATION_WHEN_IN_USE_USAGE_DESCRIPTION,
      },
    ],
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
};
};
