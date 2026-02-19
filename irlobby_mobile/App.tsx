import { DefaultTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from '@navigation/AppNavigator';
import { handlePushNavigation, navigationRef } from '@navigation/navigationRef';
import { AuthProvider } from '@providers/AuthProvider';
import { AppThemeProvider, useAppTheme } from '@providers/AppThemeProvider';
import { QueryProvider } from '@providers/queryClient';
import { useAuth } from '@hooks/useAuth';

import type { RootStackParamList } from '@navigation/types';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'irlobby://', 'https://liyf.app', 'https://www.liyf.app'],
  config: {
    screens: {
      Auth: {
        screens: {
          ResetPassword: 'reset-password/:token',
        },
      },
    },
  },
};

const AppBootstrap = () => {
  const { isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={DefaultTheme} linking={linking}>
      <AppNavigator />
    </NavigationContainer>
  );
};

const AppShell = () => {
  const { paperTheme, mode } = useAppTheme();
  const { isAuthenticated } = useAuth();
  const pendingPushDataRef = useRef<unknown>(null);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      if (!isAuthenticated) {
        pendingPushDataRef.current = data;
        return;
      }

      const handled = handlePushNavigation(data);
      if (!handled) {
        pendingPushDataRef.current = data;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!pendingPushDataRef.current) {
      return;
    }

    const handled = handlePushNavigation(pendingPushDataRef.current);
    if (handled) {
      pendingPushDataRef.current = null;
    }
  }, [isAuthenticated, mode]);

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <AppBootstrap />
    </PaperProvider>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <AuthProvider>
            <AppThemeProvider>
              <AppShell />
            </AppThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

