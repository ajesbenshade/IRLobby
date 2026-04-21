import { useEffect, useRef, type ComponentType } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

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
import { VibeQuizModalScreen } from '@screens/main/vibeQuiz/VibeQuizModalScreen';
import { VibeQuizResultsScreen } from '@screens/main/vibeQuiz/VibeQuizResultsScreen';
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

  const iconMap: Record<
    keyof MainTabParamList,
    { active: keyof typeof MaterialCommunityIcons.glyphMap; inactive: keyof typeof MaterialCommunityIcons.glyphMap }
  > = {
    Discover: { active: 'compass', inactive: 'compass-outline' },
    Activity: { active: 'calendar-month', inactive: 'calendar-month-outline' },
    Create: { active: 'plus', inactive: 'plus' },
    Chat: { active: 'message-text', inactive: 'message-text-outline' },
    Profile: { active: 'account-circle', inactive: 'account-circle-outline' },
  };
  const iconName = focused ? iconMap[routeName].active : iconMap[routeName].inactive;
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
          size={isCreateRoute ? size + 6 : size}
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
      tabBarActiveTintColor: appColors.primary,
      tabBarInactiveTintColor: appColors.softInk,
      tabBarStyle: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        height: 64,
        borderTopWidth: 0,
        borderRadius: 20,
        paddingTop: 8,
        paddingBottom: 8,
        paddingHorizontal: 8,
        backgroundColor: appColors.card,
        borderWidth: 1,
        borderColor: appColors.line,
        shadowColor: appColors.ink,
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.1,
        marginTop: 2,
      },
      tabBarItemStyle: {
        marginHorizontal: 2,
        borderRadius: 16,
      },
      tabBarIcon: ({ color, size, focused }) => (
        <TabIcon
          color={color}
          size={size}
          focused={focused}
          routeName={route.name as keyof MainTabParamList}
        />
      ),
      tabBarIconStyle: route.name === 'Create' ? { marginTop: -18 } : undefined,
      tabBarLabelPosition: 'below-icon',
    })}
  >
    <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: 'Discover' }} listeners={{ tabPress: () => { void Haptics.selectionAsync(); } }} />
    <Tab.Screen name="Activity" component={MyEventsScreen} options={{ title: 'Events' }} listeners={{ tabPress: () => { void Haptics.selectionAsync(); } }} />
    <Tab.Screen name="Create" component={CreateActivityScreen} options={{ title: 'Host' }} listeners={{ tabPress: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } }} />
    <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} listeners={{ tabPress: () => { void Haptics.selectionAsync(); } }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} listeners={{ tabPress: () => { void Haptics.selectionAsync(); } }} />
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
    <Stack.Screen
      name="VibeQuizModal"
      component={VibeQuizModalScreen}
      options={{ presentation: 'modal', title: 'Vibe Quiz' }}
    />
    <Stack.Screen
      name="VibeQuizResults"
      component={VibeQuizResultsScreen}
      options={{ title: 'Your Vibe' }}
    />
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  tabIconWrap: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  tabIconWrapFocused: {
    backgroundColor: appColors.primarySoft,
  },
  createIconWrap: {
    minWidth: 56,
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: appColors.primary,
    borderWidth: 0,
    shadowColor: appColors.ink,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
