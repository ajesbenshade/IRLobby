import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import DiscoveryScreen from './src/screens/DiscoveryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AuthScreen from './src/screens/AuthScreen';

// Import context
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Create query client
const queryClient = new QueryClient();

const Tab = createBottomTabNavigator();

function AppTabs() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: '#ffffff' },
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#000000',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Discovery" component={DiscoveryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationContainer>
          <AppTabs />
          <StatusBar style="auto" />
        </NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}
