import {
  DefaultTheme,
  NavigationContainer,
  getStateFromPath,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { ActivityIndicator } from 'react-native';

import { View } from '@components/RNCompat';
import { isFoyerMode, isTicketingUiEnabled } from '@constants/appMode';
import { config } from '@constants/config';
import { needsFoyerChurchStep, showsLegacyOnboarding, useChurchStepDone } from '@foyer/firstRun';
import { withGatheringBelowChat } from '@foyer/gatheringChat';
import { useAuth } from '@hooks/useAuth';
import { AccountDeletedScreen } from '@screens/auth/AccountDeletedScreen';
import { BirthDateGateScreen } from '@screens/auth/BirthDateGateScreen';
import { FoyerChurchStepScreen } from '@screens/auth/FoyerChurchStepScreen';
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

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    'irlobby://',
    'https://irlobby.com',
    'https://www.irlobby.com',
    'https://api.irlobby.com',
  ],
  // A link straight to a gathering chat still gets the gathering underneath, so Back returns to it.
  getStateFromPath: (path, options) => withGatheringBelowChat(getStateFromPath(path, options)),
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
              Prayer: 'prayer',
              // Legacy matches chat and the matchmaking Pings feed: not linkable in Foyer mode.
              ...(isFoyerMode() ? {} : { Chat: 'chat' }),
              Profile: 'profile',
            },
          },
          ...(isFoyerMode() ? {} : { Notifications: 'notifications' }),
          // Host is not a primary tab. `create` still opens the host flow for old Host-tab links.
          Create: 'create',
          GatheringDetail: 'gatherings/:activityId',
          GatheringChat: 'gatherings/:activityId/chat',
          PrayerCreate: 'prayer/new',
          PrayerChat: 'prayer/:prayerId/chat',
          PrayerDetail: 'prayer/:prayerId',
          ...(isTicketingUiEnabled(config.ticketingEnabled)
            ? {
                BuyTicket: 'tickets/buy/:activityId',
                TicketWallet: 'tickets/success',
                DoorScan: 'tickets/scan',
                GetPaid: 'stripe/connect/return',
              }
            : {}),
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
  const { isAuthenticated, isInitializing, user, accountDeleted, needsBirthDate } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  usePushNotificationNavigation(navigationRef);
  useChurchStepDone();


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
          needsBirthDate ? (
            <RootStack.Screen name="BirthDateGate" component={BirthDateGateScreen} />
          ) : needsFoyerChurchStep(user) ? (
            <RootStack.Screen name="ChurchStep" component={FoyerChurchStepScreen} />
          ) : showsLegacyOnboarding(user) ? (
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
