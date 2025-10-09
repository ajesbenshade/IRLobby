import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ChatScreen } from '@screens/main/ChatScreen';
import { DiscoverScreen } from '@screens/main/DiscoverScreen';
import { HomeScreen } from '@screens/main/HomeScreen';
import { MatchesScreen } from '@screens/main/MatchesScreen';
import { ProfileScreen } from '@screens/main/ProfileScreen';

import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#64748b',
      tabBarIcon: ({ color, size }) => {
        const iconMap: Record<keyof MainTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> =
          {
            Home: 'home-variant',
            Discover: 'compass-outline',
            Matches: 'heart-outline',
            Chat: 'message-text-outline',
            Profile: 'account-circle-outline',
          };
        const iconName = iconMap[route.name as keyof MainTabParamList];
        return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Discover" component={DiscoverScreen} />
    <Tab.Screen name="Matches" component={MatchesScreen} />
    <Tab.Screen name="Chat" component={ChatScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);
