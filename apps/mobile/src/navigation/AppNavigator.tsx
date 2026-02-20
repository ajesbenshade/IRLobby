import { NavigationContainer, DefaultTheme, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { OnboardingScreen } from '@screens/main/OnboardingScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'),
    'irlobby://',
    'https://liyf.app',
    'https://www.liyf.app',
  ],
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

export const AppNavigator = () => {
  const { isAuthenticated, isInitializing, user } = useAuth();

  if (isInitializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator animating size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={DefaultTheme} linking={linking}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          user?.onboardingCompleted === false ? (
            <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
          ) : (
            <RootStack.Screen name="Main" component={MainNavigator} />
          )
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
