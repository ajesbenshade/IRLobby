import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Subscribes to NetInfo and returns whether the device currently has a usable
 * internet connection. Defaults to `true` until the first NetInfo result lands
 * so we don't flash an offline banner on cold start.
 */
export const useOnline = (): boolean => {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void NetInfo.fetch().then((state) => {
      if (cancelled) return;
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return online;
};
