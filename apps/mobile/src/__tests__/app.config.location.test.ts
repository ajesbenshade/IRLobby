import fs from 'fs';
import path from 'path';

import type { ConfigContext } from 'expo/config';

import appConfig, { IOS_LOCATION_WHEN_IN_USE_USAGE_DESCRIPTION } from '../../app.config';

const REQUIRED_LOCATION_COPY =
  'The Foyer uses your location to show gatherings near you on Discover — for example, a church event a few miles away tonight.';

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

describe('production app icon', () => {
  it('points Expo and iOS at the opaque Foyer F, and Android adaptive at the transparent mark', () => {
    const config = appConfig({ config: {} } as ConfigContext);
    const iconPath = './assets/AppIcon-1024.png';

    expect(config.icon).toBe(iconPath);
    expect(config.ios?.icon).toBe(iconPath);
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe('./assets/adaptive-icon.png');
    expect(config.android?.adaptiveIcon?.backgroundColor).toBe('#a2033f');
    expect(config.splash?.backgroundColor).toBe('#a2033f');

    const notificationPlugin = (config.plugins ?? []).find(
      (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications',
    ) as [string, { icon?: string; color?: string }] | undefined;
    expect(notificationPlugin?.[1]?.icon).toBe('./assets/notification-icon.png');
    expect(notificationPlugin?.[1]?.color).toBe('#a2033f');

    const assetsDir = path.resolve(__dirname, '../../assets');
    const master = path.join(assetsDir, 'AppIcon-1024.png');
    const iconPng = path.join(assetsDir, 'icon.png');
    const adaptivePng = path.join(assetsDir, 'adaptive-icon.png');
    expect(fs.existsSync(master)).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, 'notification-icon.png'))).toBe(true);
    expect(fs.readFileSync(iconPng).equals(fs.readFileSync(master))).toBe(true);
    expect(fs.readFileSync(adaptivePng).equals(fs.readFileSync(master))).toBe(false);

    const contents = JSON.parse(
      fs.readFileSync(path.join(assetsDir, 'AppIcon.appiconset/Contents.json'), 'utf8'),
    ) as { images: { filename?: string }[] };
    for (const image of contents.images) {
      if (!image.filename) continue;
      expect(fs.existsSync(path.join(assetsDir, 'AppIcon.appiconset', image.filename))).toBe(true);
    }
  });
});

describe('photo saving permissions', () => {
  it('adds the add-only Photos string and the expo-media-library plugin', () => {
    const config = appConfig({ config: {} } as ConfigContext);
    expect(config.ios?.infoPlist?.NSPhotoLibraryAddUsageDescription).toBe('Save event photos to your library.');
    const plugin = (config.plugins ?? []).find((entry) => Array.isArray(entry) && entry[0] === 'expo-media-library') as
      | [string, { savePhotosPermission?: string }]
      | undefined;
    expect(plugin?.[1]?.savePhotosPermission).toBe('Save event photos to your library.');
    expect(config.ios?.bundleIdentifier).toBe('com.irlobby.app');
  });
});
