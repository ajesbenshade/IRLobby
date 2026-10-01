import { useEffect, useRef, type ComponentType } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Animated, StyleSheet } from 'react-native';

import { View } from '@components/RNCompat';
import { safeImpactHaptic, safeSelectionHaptic } from '@lib/haptics';

import { ChatScreen } from '@screens/main/ChatScreen';
import { CreateActivityScreen, EditActivityScreen } from '@screens/main/CreateActivityScreen';
import { DiscoverScreen } from '@screens/main/DiscoverScreen';
import { GetPaidScreen } from '@screens/main/GetPaidScreen';
import { BuyTicketScreen } from '@screens/main/tickets/BuyTicketScreen';
import { DoorScanScreen } from '@screens/main/tickets/DoorScanScreen';
import { TicketWalletScreen } from '@screens/main/tickets/TicketWalletScreen';
import { FriendsScreen } from '@screens/main/FriendsScreen';
import { MyEventsScreen } from '@screens/main/MyEventsScreen';
import { NotificationsScreen } from '@screens/main/NotificationsScreen';
import { ProfileScreen } from '@screens/main/ProfileScreen';
import { ReviewsScreen } from '@screens/main/ReviewsScreen';
import { AccountScreen } from '@screens/main/AccountScreen';
import { SettingsScreen } from '@screens/main/SettingsScreen';
import { VibeQuizModalScreen } from '@screens/main/vibeQuiz/VibeQuizModalScreen';
import { VibeQuizResultsScreen } from '@screens/main/vibeQuiz/VibeQuizResultsScreen';
import { WebContentScreen } from '@screens/main/WebContentScreen';
import { isTicketingUiEnabled } from '@constants/appMode';
import { config } from '@constants/config';
import { appColors } from '@theme/index';

import { TAB_ICON_SIZE, TAB_LABEL_LINE_HEIGHT, useTabBarLayout } from './tabBarLayout';
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
          size={size}
          color={isCreateRoute ? appColors.white : color}
        />
      </View>
    </AnimatedView>
  );
};

const MainTabs = () => {
  const tabBar = useTabBarLayout();

  return (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      sceneStyle: { backgroundColor: appColors.background },
      tabBarActiveTintColor: appColors.primary,
      tabBarInactiveTintColor: appColors.softInk,
      tabBarStyle: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: tabBar.bottomOffset,
        height: tabBar.height,
        borderTopWidth: 0,
        borderRadius: 20,
        // React Navigation adds insets.bottom as padding by default; the bar already
        // floats above the inset (see tabBarLayout), so the items are centered instead.
        paddingTop: 0,
        paddingBottom: 0,
        paddingHorizontal: 6,
        backgroundColor: appColors.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: appColors.line,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.1,
        lineHeight: TAB_LABEL_LINE_HEIGHT,
        marginTop: 1,
      },
      tabBarItemStyle: {
        marginHorizontal: 2,
        borderRadius: 16,
        justifyContent: 'center',
      },
      tabBarIcon: ({ color, focused }) => (
        <TabIcon
          color={color}
          size={TAB_ICON_SIZE}
          focused={focused}
          routeName={route.name as keyof MainTabParamList}
        />
      ),
      tabBarIconStyle: undefined,
      tabBarLabelPosition: 'below-icon',
    })}
  >
    <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: 'Discover' }} listeners={{ tabPress: () => { void safeSelectionHaptic(); } }} />
    <Tab.Screen name="Activity" component={MyEventsScreen} options={{ title: 'Gatherings' }} listeners={{ tabPress: () => { void safeSelectionHaptic(); } }} />
    <Tab.Screen name="Create" component={CreateActivityScreen} options={{ title: 'Host' }} listeners={{ tabPress: () => { void safeImpactHaptic('medium'); } }} />
    <Tab.Screen
      name="Chat"
      component={ChatScreen}
      options={{
        title: 'Chat',
        tabBarButton: () => null,
        tabBarItemStyle: { display: 'none', width: 0, height: 0, maxWidth: 0 },
      }}
    />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} listeners={{ tabPress: () => { void safeSelectionHaptic(); } }} />
  </Tab.Navigator>
  );
};

export const MainNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShadowVisible: false,
      headerStyle: { backgroundColor: appColors.background },
      headerTintColor: appColors.ink,
      headerTitleStyle: { fontWeight: '600' },
      contentStyle: { backgroundColor: appColors.background },
    }}
  >
    <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
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
      initialParams={{ title: 'Help & Support', url: 'https://irlobby.com/help-support' }}
      options={{ title: 'Help & Support' }}
    />
    <Stack.Screen
      name="PrivacyPolicy"
      component={WebContentScreen}
      initialParams={{ title: 'Privacy Policy', url: 'https://irlobby.com/privacy-policy' }}
      options={{ title: 'Privacy Policy' }}
    />
    <Stack.Screen
      name="TermsOfService"
      component={WebContentScreen}
      initialParams={{ title: 'Terms of Service', url: 'https://irlobby.com/terms-of-service' }}
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
    {isTicketingUiEnabled(config.ticketingEnabled) ? (
      <>
        <Stack.Screen
          name="BuyTicket"
          component={BuyTicketScreen}
          options={{ headerShown: false, title: 'Buy ticket' }}
        />
        <Stack.Screen
          name="TicketWallet"
          component={TicketWalletScreen}
          options={{ headerShown: false, title: 'Your ticket' }}
        />
        <Stack.Screen
          name="DoorScan"
          component={DoorScanScreen}
          options={{ headerShown: false, title: 'Door scan' }}
        />
        <Stack.Screen
          name="GetPaid"
          component={GetPaidScreen}
          options={{ headerShown: false, title: 'Get paid' }}
        />
      </>
    ) : null}
    <Stack.Screen
      name="EditActivity"
      component={EditActivityScreen}
      options={{ title: 'Edit event' }}
    />
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  tabIconWrap: {
    minWidth: 40,
    minHeight: TAB_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabIconWrapFocused: {
    backgroundColor: appColors.primaryWash,
  },
  createIconWrap: {
    minWidth: 40,
    minHeight: TAB_ICON_SIZE,
    borderRadius: 10,
    backgroundColor: appColors.primary,
  },
});
