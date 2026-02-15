import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChatScreen } from '@screens/main/ChatScreen';
import { CreateActivityScreen } from '@screens/main/CreateActivityScreen';
import { DiscoverScreen } from '@screens/main/DiscoverScreen';
import { FriendsScreen } from '@screens/main/FriendsScreen';
import { HomeScreen } from '@screens/main/HomeScreen';
import { MatchesScreen } from '@screens/main/MatchesScreen';
import { MyEventsScreen } from '@screens/main/MyEventsScreen';
import { NotificationsScreen } from '@screens/main/NotificationsScreen';
import { ProfileScreen } from '@screens/main/ProfileScreen';
import { ReviewsScreen } from '@screens/main/ReviewsScreen';
import { SettingsScreen } from '@screens/main/SettingsScreen';
import { WebContentScreen } from '@screens/main/WebContentScreen';

import type { MainStackParamList, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#64748b',
      tabBarIcon: ({ color, size }) => {
        const iconMap: Record<keyof MainTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> =
          {
            Home: 'home-variant',
            MyEvents: 'calendar-month-outline',
            Discover: 'compass-outline',
            Create: 'plus-circle-outline',
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
    <Tab.Screen name="MyEvents" component={MyEventsScreen} options={{ title: 'My Events' }} />
    <Tab.Screen name="Discover" component={DiscoverScreen} />
    <Tab.Screen name="Create" component={CreateActivityScreen} />
    <Tab.Screen name="Matches" component={MatchesScreen} />
    <Tab.Screen name="Chat" component={ChatScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export const MainNavigator = () => (
  <Stack.Navigator>
    <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    <Stack.Screen name="Friends" component={FriendsScreen} options={{ title: 'Connections' }} />
    <Stack.Screen name="Reviews" component={ReviewsScreen} options={{ title: 'Reviews' }} />
    <Stack.Screen
      name="Notifications"
      component={NotificationsScreen}
      options={{ title: 'Notifications' }}
    />
    <Stack.Screen
      name="HelpSupport"
      component={WebContentScreen}
      initialParams={{ title: 'Help & Support', url: 'https://liyf.app/help-support' }}
      options={{ title: 'Help & Support' }}
    />
    <Stack.Screen
      name="PrivacyPolicy"
      component={WebContentScreen}
      initialParams={{ title: 'Privacy Policy', url: 'https://liyf.app/privacy-policy' }}
      options={{ title: 'Privacy Policy' }}
    />
    <Stack.Screen
      name="TermsOfService"
      component={WebContentScreen}
      initialParams={{ title: 'Terms of Service', url: 'https://liyf.app/terms-of-service' }}
      options={{ title: 'Terms of Service' }}
    />
    <Stack.Screen
      name="WebContent"
      component={WebContentScreen}
      options={({ route }) => ({ title: route.params?.title ?? 'Details' })}
    />
  </Stack.Navigator>
);
