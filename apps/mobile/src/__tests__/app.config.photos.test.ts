import type { ConfigContext } from 'expo/config';

import appConfig from '../../app.config';

describe('iOS photo library permission is add-only', () => {
  const config = appConfig({ config: {} } as ConfigContext);

  it('declares only the add-only usage description', () => {
    const infoPlist = (config.ios?.infoPlist ?? {}) as Record<string, string>;
    expect(Object.keys(infoPlist).filter((key) => key.startsWith('NSPhotoLibrary'))).toEqual(['NSPhotoLibraryAddUsageDescription']);
    expect(infoPlist.NSPhotoLibraryAddUsageDescription).toBe(
      "Saved photos from gatherings are added to your photo library. The Foyer can't see your other photos.",
    );
  });

  it('turns off the read description in the media-library plugin', () => {
    const plugin = (config.plugins ?? []).find((entry) => Array.isArray(entry) && entry[0] === 'expo-media-library') as
      | [string, { photosPermission?: string | false; savePhotosPermission?: string }]
      | undefined;
    expect(plugin?.[1].photosPermission).toBe(false);
    expect(plugin?.[1].savePhotosPermission).toBe(
      "Saved photos from gatherings are added to your photo library. The Foyer can't see your other photos.",
    );
  });
});
