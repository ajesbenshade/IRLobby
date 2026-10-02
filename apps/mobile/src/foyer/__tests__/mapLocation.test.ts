import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  FRANCONIA_CENTER,
  USE_LOCATION_KEY,
  getUseMyLocation,
  resolveMapCenter,
  setUseMyLocation,
} from '../mapLocation';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => void store.set(key, value)),
      removeItem: jest.fn(async (key: string) => void store.delete(key)),
    },
  };
});

const location = (overrides: Partial<{ status: string; position: () => Promise<unknown> }> = {}) => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: overrides.status ?? 'granted' })),
  getCurrentPositionAsync: jest.fn(overrides.position ?? (async () => ({ coords: { latitude: 40.31, longitude: -75.33 } }))),
});

describe('Use my location for maps', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(USE_LOCATION_KEY);
  });

  it('is off by default and stored locally', async () => {
    expect(await getUseMyLocation()).toBe(false);
    await setUseMyLocation(true);
    expect(await getUseMyLocation()).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(USE_LOCATION_KEY, 'true');
    await setUseMyLocation(false);
    expect(await getUseMyLocation()).toBe(false);
  });

  it('with the setting off it never loads or asks the OS and opens on Franconia', async () => {
    const loadLocation = jest.fn();
    const result = await resolveMapCenter({ loadLocation: loadLocation as never });
    expect(loadLocation).not.toHaveBeenCalled();
    expect(result).toEqual({ center: FRANCONIA_CENTER, source: 'default' });
  });

  it('with the setting on it asks the OS once and centers on the user', async () => {
    await setUseMyLocation(true);
    const module = location();
    const result = await resolveMapCenter({ loadLocation: async () => module as never });
    expect(module.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ center: { latitude: 40.31, longitude: -75.33 }, source: 'user' });
  });

  it.each([
    ['OS denied', location({ status: 'denied' })],
    ['unavailable', location({ position: async () => { throw new Error('Location unavailable'); } })],
    ['bad fix', location({ position: async () => ({ coords: { latitude: NaN, longitude: 1 } }) })],
  ])('falls back to Franconia silently when %s', async (_name, module) => {
    const result = await resolveMapCenter({ enabled: true, loadLocation: async () => module as never });
    expect(result).toEqual({ center: FRANCONIA_CENTER, source: 'default' });
  });

  it('falls back to Franconia when the fix times out', async () => {
    const module = location({ position: () => new Promise(() => undefined) });
    const result = await resolveMapCenter({ enabled: true, loadLocation: async () => module as never, timeoutMs: 20 });
    expect(result.source).toBe('default');
  });

  it('falls back when the location module itself fails to load', async () => {
    const result = await resolveMapCenter({ enabled: true, loadLocation: async () => { throw new Error('no native module'); } });
    expect(result.source).toBe('default');
  });

  it('reads a broken store as off', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    expect(await getUseMyLocation()).toBe(false);
  });
});

// ---- Source guard: the OS location prompt may only be reachable from the setting-gated resolver or the legacy flows ----
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

describe('source guard: OS location permission', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (name === '__tests__' || name === 'node_modules') {
        return [];
      }
      return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : [];
    });

  it('requests foreground permission only in mapLocation (setting-gated) and the legacy IRLobby screens', () => {
    const src = join(__dirname, '..', '..');
    const files = walk(src)
      .filter((file) => readFileSync(file, 'utf8').includes('requestForegroundPermissionsAsync'))
      .map((file) => file.replace(src, ''))
      .sort();
    expect(files).toEqual(['/foyer/mapLocation.ts', '/screens/main/CreateActivityScreen.tsx', '/screens/main/OnboardingScreen.tsx']);
    // CreateActivityScreen returns FoyerHostForm before its legacy code runs; Onboarding hides its button in Foyer mode.
    expect(readFileSync(join(src, 'screens/main/CreateActivityScreen.tsx'), 'utf8')).toMatch(/if \(isFoyerMode\(\)\) \{\s*return <FoyerHostForm/);
    expect(readFileSync(join(src, 'screens/main/OnboardingScreen.tsx'), 'utf8')).toMatch(/isFoyerMode\(\) \? null : \(\s*<AppButton onPress=\{\(\) => void requestLocationPermission/);
  });
});
