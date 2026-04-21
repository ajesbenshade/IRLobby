import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { PropsWithChildren, useEffect, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

const VIBE_QUERY_KEY_PREFIXES = ['vibe-quiz-match-count'] as const;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      },
      mutations: {
        retry: 0,
      },
    },
  });

const createPersister = () =>
  createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'rq-cache-v1',
    throttleTime: 1000,
  });

// Wire react-query's online + focus managers to React Native's primitives once
// per app session. Without these the existing `refetchOnReconnect` setting
// never fires because react-query has no DOM `online` event to listen to.
let nativeManagersWired = false;
const wireNativeManagers = () => {
  if (nativeManagersWired) return;
  nativeManagersWired = true;

  onlineManager.setEventListener((setOnline) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
    });
    return unsubscribe;
  });

  focusManager.setEventListener((handleFocus) => {
    const onChange = (status: AppStateStatus) => {
      if (Platform.OS !== 'web') handleFocus(status === 'active');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  });
};

const isVibeQueryKey = (key: readonly unknown[]): boolean => {
  const head = key[0];
  return (
    typeof head === 'string' &&
    (VIBE_QUERY_KEY_PREFIXES as readonly string[]).includes(head)
  );
};

export const QueryProvider = ({ children }: PropsWithChildren) => {
  const [client] = useState(() => createQueryClient());
  const [persister] = useState(() => createPersister());

  useEffect(() => {
    wireNativeManagers();
  }, []);

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        // Bump when the persisted cache shape changes.
        buster: 'v1',
        maxAge: 24 * 60 * 60 * 1000,
        dehydrateOptions: {
          // Persist only vibe-quiz queries to keep AsyncStorage small.
          shouldDehydrateQuery: (query) => isVibeQueryKey(query.queryKey),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};
