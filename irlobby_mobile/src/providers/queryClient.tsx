import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { PropsWithChildren, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

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

export const QueryProvider = ({ children }: PropsWithChildren) => {
  const [client] = useState(() => createQueryClient());

  useEffect(() => {
    onlineManager.setEventListener((setOnline) => {
      return NetInfo.addEventListener((state) => {
        const isOnline =
          Boolean(state.isConnected) &&
          (state.isInternetReachable == null ? true : Boolean(state.isInternetReachable));
        setOnline(isOnline);
      });
    });

    const onAppStateChange = (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
