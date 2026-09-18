import type { ConfigContext } from 'expo/config';

import appConfig, { IOS_LOCATION_WHEN_IN_USE_USAGE_DESCRIPTION } from '../../app.config';

const REQUIRED_LOCATION_COPY =
  'IRLobby uses your location to show hangouts near you on Discover — for example, a rooftop hang a few miles away tonight.';

describe('iOS location usage description', () => {
  it('sets every NSLocation* Info.plist string to the App Review copy', () => {
    expect(IOS_LOCATION_WHEN_IN_USE_USAGE_DESCRIPTION).toBe(REQUIRED_LOCATION_COPY);

    const config = appConfig({ config: {} } as ConfigContext);
    const infoPlist = config.ios?.infoPlist ?? {};
    const locationKeys = Object.keys(infoPlist).filter((key) => key.startsWith('NSLocation'));

    expect(locationKeys).toEqual(['NSLocationWhenInUseUsageDescription']);
    for (const key of locationKeys) {
      expect(infoPlist[key as keyof typeof infoPlist]).toBe(REQUIRED_LOCATION_COPY);
    }

    const locationPlugin = (config.plugins ?? []).find((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-location',
    ) as [string, { locationWhenInUsePermission?: string }] | undefined;

    expect(locationPlugin?.[1]?.locationWhenInUsePermission).toBe(REQUIRED_LOCATION_COPY);
  });
});

describe('Google client IDs in extra', () => {
  const ORIGINAL_ENV = { ...process.env };

  const restoreEnv = (name: string) => {
    const value = ORIGINAL_ENV[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  };

  afterEach(() => {
    restoreEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID');
    restoreEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
    restoreEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID');
  });

  it('bakes trimmed EXPO_PUBLIC_GOOGLE_* values into extra and the reversed iOS scheme', () => {
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID =
      '  123-ios.apps.googleusercontent.com  ';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID =
      '123-web.apps.googleusercontent.com';
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID =
      '123-android.apps.googleusercontent.com';

    const config = appConfig({ config: {} } as ConfigContext);

    expect(config.extra?.googleIosClientId).toBe(
      '123-ios.apps.googleusercontent.com',
    );
    expect(config.extra?.googleWebClientId).toBe(
      '123-web.apps.googleusercontent.com',
    );
    expect(config.extra?.googleAndroidClientId).toBe(
      '123-android.apps.googleusercontent.com',
    );
    expect(config.scheme).toEqual([
      'irlobby',
      'com.googleusercontent.apps.123-ios',
    ]);
  });
});
