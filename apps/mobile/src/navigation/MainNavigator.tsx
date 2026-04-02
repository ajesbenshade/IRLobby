import { useEffect, useRef, type ComponentType } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Animated, StyleSheet } from 'react-native';

import { View } from '@components/RNCompat';

import { ChatScreen } from '@screens/main/ChatScreen';
import { CreateActivityScreen } from '@screens/main/CreateActivityScreen';
import { DiscoverScreen } from '@screens/main/DiscoverScreen';
import { FriendsScreen } from '@screens/main/FriendsScreen';
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
const AnimatedView = Animated.View as unknown as ComponentType<any>;

type TabIconProps = {
  color: string;
  size: number;
  focused: boolean;
  routeName: keyof MainTabParamList;
};

const TabIcon = ({ color, size, focused, routeName }: TabIconProps) => {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.94)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.82)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1 : 0.94,
        friction: 7,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: focused ? 1 : 0.82,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, opacity, scale]);

  const iconMap: Record<keyof MainTabParamList, keyof typeof MaterialCommunityIcons.glyphMap> = {
    Discover: 'compass-outline',
    Activity: 'calendar-month-outline',
    Create: 'plus-circle-outline',
    Chat: 'message-text-outline',
    Profile: 'account-circle-outline',
  };
  const iconName = iconMap[routeName];
  const isCreateRoute = routeName === 'Create';

  return (
    <AnimatedView
      style={{
        opacity,
        transform: [{ scale }],
      }}
    >
      <View
        style={[
          styles.tabIconWrap,
          focused && !isCreateRoute ? styles.tabIconWrapFocused : null,
          isCreateRoute ? styles.createIconWrap : null,
        ]}
      >
        <MaterialCommunityIcons
          name={iconName}
          size={isCreateRoute ? size + 2 : size}
          color={isCreateRoute ? appColors.white : color}
        />
      </View>
    </AnimatedView>
  );
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      sceneStyle: { backgroundColor: appColors.background },
      tabBarActiveTintColor: appColors.primaryDeep,
      tabBarInactiveTintColor: appColors.softInk,
      tabBarStyle: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 18,
        height: 78,
        borderTopWidth: 0,
        borderRadius: 30,
        paddingTop: 10,
        paddingBottom: 10,
        paddingHorizontal: 8,
        backgroundColor: appColors.card,
        borderWidth: 1,
        borderColor: '#f3dfe8',
        shadowColor: '#8f3465',
        shadowOpacity: 0.16,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 10,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.1,
      },
      tabBarItemStyle: {
        marginHorizontal: 2,
        borderRadius: 22,
      },
      tabBarIcon: ({ color, size, focused }) => (
        <TabIcon
          color={color}
          size={size}
          focused={focused}
          routeName={route.name as keyof MainTabParamList}
        />
      ),
      tabBarIconStyle: route.name === 'Create' ? { marginTop: -4 } : undefined,
      tabBarLabelPosition: 'below-icon',
    })}
  >
    <Tab.Screen name="Discover" component={DiscoverScreen} />
    <Tab.Screen name="Activity" component={MyEventsScreen} options={{ title: 'Activity' }} />
    <Tab.Screen name="Create" component={CreateActivityScreen} options={{ title: 'Host' }} />
    <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'Sparks' }} />
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

const styles = StyleSheet.create({
  tabIconWrap: {
    minWidth: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  tabIconWrapFocused: {
    backgroundColor: appColors.backgroundAccent,
    borderWidth: 1,
    borderColor: '#ffc8d8',
  },
  createIconWrap: {
    minWidth: 42,
    minHeight: 42,
    backgroundColor: appColors.primary,
    borderWidth: 1,
    borderColor: '#ff8fb1',
    shadowColor: '#b8386e',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
