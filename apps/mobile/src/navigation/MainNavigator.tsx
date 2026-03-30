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
import { appColors } from '@theme/index';

import type { MainStackParamList, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      sceneStyle: { backgroundColor: appColors.background },
      tabBarActiveTintColor: appColors.primary,
      tabBarInactiveTintColor: '#7d8aa5',
      tabBarStyle: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 18,
        height: 74,
        borderTopWidth: 0,
        borderRadius: 28,
        paddingTop: 10,
        paddingBottom: 10,
        paddingHorizontal: 8,
        backgroundColor: appColors.card,
        shadowColor: '#24304d',
        shadowOpacity: 0.14,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '700',
      },
      tabBarItemStyle: {
        borderRadius: 20,
      },
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
        const isCreateRoute = route.name === 'Create';
        return (
          <MaterialCommunityIcons
            name={iconName}
            size={isCreateRoute ? size + 3 : size}
            color={isCreateRoute ? appColors.white : color}
            style={
              isCreateRoute
                ? {
                    backgroundColor: appColors.primary,
                    borderRadius: 18,
                    overflow: 'hidden',
                    padding: 8,
                  }
                : undefined
            }
          />
        );
      },
      tabBarIconStyle: route.name === 'Create' ? { marginTop: -2 } : undefined,
      tabBarLabelPosition: 'below-icon',
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
  <Stack.Navigator
    screenOptions={{
      headerShadowVisible: false,
      headerStyle: { backgroundColor: appColors.background },
      headerTintColor: appColors.ink,
      headerTitleStyle: { fontWeight: '800' },
      contentStyle: { backgroundColor: appColors.background },
    }}
  >
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
