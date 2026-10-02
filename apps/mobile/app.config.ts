import type { ConfigContext, ExpoConfig } from 'expo/config';

const readExpoPublic = (name: string) => process.env[name]?.trim() || undefined;

export const reverseGoogleIosClientIdScheme = (iosClientId?: string) => {
  const trimmed = iosClientId?.trim() || '';
  return trimmed.endsWith('.apps.googleusercontent.com')
    ? trimmed.split('.').reverse().join('.')
    : undefined;
};

/** Add-only Photos permission for saving event photos (requested only when someone taps Download). */
export const IOS_PHOTO_LIBRARY_ADD_USAGE_DESCRIPTION =
  "Saved photos from gatherings are added to your photo library. The Foyer can't see your other photos.";

/** Guideline 5.1.1(ii) — keep every NSLocation* string identical to this copy. */
export const IOS_LOCATION_WHEN_IN_USE_USAGE_DESCRIPTION =
  'The Foyer uses your location to show gatherings near you on Discover — for example, a church event a few miles away tonight.';

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIosClientId = readExpoPublic('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID') || '';
  const googleReversedClientIdScheme = reverseGoogleIosClientIdScheme(googleIosClientId);

  return {
  ...config,
  name: 'The Foyer',
  slug: 'irlobby',
  version: '1.0.0',
  description: 'The Foyer — gatherings for Franconia Mennonite Church.',
  orientation: 'portrait',
  icon: './assets/AppIcon-1024.png',
  scheme: googleReversedClientIdScheme ? ['irlobby', googleReversedClientIdScheme] : 'irlobby',
  userInterfaceStyle: 'automatic',
  primaryColor: '#a2033f',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#a2033f',
    dark: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#a2033f',
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
    ticketingEnabled: readExpoPublic('EXPO_PUBLIC_ENABLE_TICKETING'),
    appMode: readExpoPublic('EXPO_PUBLIC_APP_MODE') || 'foyer',
    eas: {
      projectId: '9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe',
    },
  },
  ios: {
    icon: './assets/AppIcon-1024.png',
    supportsTablet: false,
    bundleIdentifier: 'com.irlobby.app',
    usesAppleSignIn: true,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSCameraUsageDescription:
        'The Foyer uses the camera to capture photos for gatherings and profile updates.',
      NSLocationWhenInUseUsageDescription: IOS_LOCATION_WHEN_IN_USE_USAGE_DESCRIPTION,
      NSPhotoLibraryAddUsageDescription: IOS_PHOTO_LIBRARY_ADD_USAGE_DESCRIPTION,
      CFBundleDisplayName: 'The Foyer',
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
      backgroundColor: '#a2033f',
    },
  },
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#a2033f',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'The Foyer uses the camera to capture photos for gatherings and profile updates.',
        recordAudioAndroid: false,
      },
    ],
    'expo-font',
    [
      // Needs a full EAS build (new native module). The app only asks for add-only access.
      'expo-media-library',
      {
        // `false` omits NSPhotoLibraryUsageDescription: the app never asks for read access to the library.
        // Picking a photo uses the system picker (no permission); saving uses add-only access.
        photosPermission: false,
        savePhotosPermission: IOS_PHOTO_LIBRARY_ADD_USAGE_DESCRIPTION,
        isAccessMediaLocationEnabled: false,
        granularPermissions: ['photo'],
      },
    ],
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
