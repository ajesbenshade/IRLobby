import { DefaultTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { ActivityIndicator } from 'react-native';

import { View } from '@components/RNCompat';
import { useAuth } from '@hooks/useAuth';
import { AccountDeletedScreen } from '@screens/auth/AccountDeletedScreen';
import { OnboardingScreen } from '@screens/main/OnboardingScreen';
import {
  useNavigationContainerRef,
  usePushNotificationNavigation,
} from '@services/pushNotificationNavigation';
import { appColors } from '@theme/index';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    'irlobby://',
    'https://irlobby.com',
    'https://www.irlobby.com',
    'https://api.irlobby.com',
  ],
  config: {
    screens: {
      Auth: {
        screens: {
          ResetPassword: 'reset-password/:token',
        },
      },
      Main: {
        screens: {
          Tabs: {
            screens: {
              Discover: 'discover',
              Activity: 'activity',
              Create: 'create',
              Chat: 'chat',
              Profile: 'profile',
            },
          },
          Notifications: 'notifications',
          BuyTicket: 'tickets/buy/:activityId',
          TicketWallet: 'tickets/success',
          DoorScan: 'tickets/scan',
          GetPaid: 'stripe/connect/return',
        },
      },
    },
  },
};

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: appColors.primary,
    background: appColors.background,
    card: appColors.card,
    text: appColors.ink,
    border: appColors.line,
    notification: appColors.secondary,
  },
};

export const AppNavigator = () => {
  const { isAuthenticated, isInitializing, user, accountDeleted } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  usePushNotificationNavigation(navigationRef);


  if (isInitializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: appColors.background,
        }}
      >
        <ActivityIndicator size="large" color={appColors.primaryGlow} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} linking={linking}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          user?.onboardingCompleted === false ? (
            <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
          ) : (
            <RootStack.Screen name="Main" component={MainNavigator} />
          )
        ) : accountDeleted ? (
          <RootStack.Screen name="AccountDeleted" component={AccountDeletedScreen} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
