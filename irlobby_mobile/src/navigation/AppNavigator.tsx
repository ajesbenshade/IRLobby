import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useColorScheme, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

import { useAuth } from '@hooks/useAuth';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import type { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const scheme = useColorScheme();
  const { isAuthenticated, isInitializing } = useAuth();

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
    <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
