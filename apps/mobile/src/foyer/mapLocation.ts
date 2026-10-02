import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * `Use my location for maps` (Profile). A LOCAL on-device setting, default OFF, stored in AsyncStorage. There is no
 * account-level API for it. The OS location permission is requested only when this is ON; with it off (or denied, or
 * unavailable, or timed out) every map falls back silently to the Franconia, PA default: no OS prompt and no error.
 */
export const USE_LOCATION_KEY = '@irlobby/maps/use-my-location';

export type MapCenter = { latitude: number; longitude: number };

/** Franconia, PA (Franconia Mennonite Church area). */
export const FRANCONIA_CENTER: MapCenter = { latitude: 40.2866, longitude: -75.3877 };
export const DEFAULT_DELTA = 0.05;
export const LOCATION_TIMEOUT_MS = 8000;

export const getUseMyLocation = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(USE_LOCATION_KEY)) === 'true';
  } catch {
    return false;
  }
};

/** Throws when the value cannot be stored so the Profile switch can snap back and show its error. */
export const setUseMyLocation = async (value: boolean): Promise<void> => {
  if (value) {
    await AsyncStorage.setItem(USE_LOCATION_KEY, 'true');
  } else {
    await AsyncStorage.removeItem(USE_LOCATION_KEY);
  }
};

type LocationModule = {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (options?: object) => Promise<{ coords: { latitude: number; longitude: number } }>;
};

const withTimeout = <T,>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('location timed out')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

export type MapCenterResult = { center: MapCenter; source: 'user' | 'default' };

const FALLBACK: MapCenterResult = { center: FRANCONIA_CENTER, source: 'default' };

/**
 * Where a map should open. The location module is loaded only when the setting is on, so with it off nothing native is
 * touched and nothing can prompt.
 */
export const resolveMapCenter = async (
  options: { enabled?: boolean; loadLocation?: () => Promise<LocationModule>; timeoutMs?: number } = {},
): Promise<MapCenterResult> => {
  const enabled = options.enabled ?? (await getUseMyLocation());
  if (!enabled) {
    return FALLBACK;
  }
  try {
    const Location = await (options.loadLocation ?? (() => import('expo-location') as unknown as Promise<LocationModule>))();
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return FALLBACK;
    }
    const position = await withTimeout(Location.getCurrentPositionAsync({}), options.timeoutMs ?? LOCATION_TIMEOUT_MS);
    const { latitude, longitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return FALLBACK;
    }
    return { center: { latitude, longitude }, source: 'user' };
  } catch {
    return FALLBACK;
  }
};

/** Map center for a picker. Starts at Franconia and moves to the user only if the setting is on and a fix arrives. */
export const useMapCenter = (active = true): MapCenterResult & { loading: boolean } => {
  const [state, setState] = useState<MapCenterResult>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    void resolveMapCenter().then((result) => {
      if (!cancelled) {
        setState(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { ...state, loading };
};

/** The profile switch: reads the stored value, saves with a pending state, and reports a failure so the switch can snap back. */
export const useUseMyLocationSetting = () => {
  const [value, setValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getUseMyLocation().then((stored) => {
      if (!cancelled) {
        setValue(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (next: boolean) => {
    setSaving(true);
    setError(false);
    try {
      await setUseMyLocation(next);
      setValue(next);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }, []);

  return { value, saving, error, update };
};
