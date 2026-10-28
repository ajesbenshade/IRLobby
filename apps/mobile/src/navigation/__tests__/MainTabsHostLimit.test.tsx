import type React from 'react';
import { render, screen } from '@testing-library/react-native';

import { MainNavigator } from '../MainNavigator';

let mockUser: Record<string, unknown> = {};
const mockTabNavigations: string[] = [];

jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser, refreshProfile: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@lib/haptics', () => ({ safeImpactHaptic: jest.fn(), safeSelectionHaptic: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  SafeAreaInsetsContext: require('react').createContext(null),
  SafeAreaView: require('react-native').View,
}));
// Stack: render only the first screen (the tabs).
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => {
      const R = require('react') as typeof React;
      const first = R.Children.toArray(children)[0] as React.ReactElement<{ component: React.ComponentType }>;
      return R.createElement(first.props.component);
    },
    Screen: () => null,
  }),
}));
// Tabs: draw each tab's label with its tint, and a button that runs the tab's tabPress listener.
jest.mock('@react-navigation/bottom-tabs', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    BottomTabBarHeightContext: R.createContext(undefined),
    createBottomTabNavigator: () => ({
      Navigator: ({ children, screenOptions }: { children: React.ReactNode; screenOptions: (a: unknown) => Record<string, unknown> }) =>
        R.createElement(
          RN.View,
          null,
          R.Children.toArray(children).map((child: React.ReactElement<{ name: string; options?: { title?: string }; listeners?: { tabPress?: (e: unknown) => void } }>) => {
            const { name, options, listeners } = child.props;
            const resolved = screenOptions({ route: { name } }) as { tabBarLabel: (a: unknown) => React.ReactElement };
            const label = resolved.tabBarLabel({ color: '#857f7a', children: options?.title ?? name });
            return R.createElement(
              RN.Pressable,
              {
                key: name,
                testID: `tab-${name}`,
                onPress: () => {
                  let prevented = false;
                  listeners?.tabPress?.({ preventDefault: () => (prevented = true) });
                  if (!prevented) {
                    mockTabNavigations.push(name);
                  }
                },
              },
              label,
            );
          }),
        ),
      Screen: () => null,
    }),
  };
});
jest.mock('@screens/main/AccountScreen', () => ({ AccountScreen: () => null }));
jest.mock('@screens/main/ChatScreen', () => ({ ChatScreen: () => null }));
jest.mock('@screens/main/CreateActivityScreen', () => ({ CreateActivityScreen: () => null, EditActivityScreen: () => null }));
jest.mock('@screens/main/DirectChatScreen', () => ({ DirectChatScreen: () => null }));
jest.mock('@screens/main/DiscoverScreen', () => ({ DiscoverScreen: () => null }));
jest.mock('@screens/main/FoyerFriendsScreen', () => ({ FoyerFriendsScreen: () => null }));
jest.mock('@screens/main/FriendsScreen', () => ({ FriendsScreen: () => null }));
jest.mock('@screens/main/GatheringChatScreen', () => ({ GatheringChatScreen: () => null }));
jest.mock('@screens/main/GatheringDetailScreen', () => ({ GatheringDetailScreen: () => null }));
jest.mock('@screens/main/GetPaidScreen', () => ({ GetPaidScreen: () => null }));
jest.mock('@screens/main/MemberProfileScreen', () => ({ MemberProfileScreen: () => null }));
jest.mock('@screens/main/MessagingScreen', () => ({ MessagingScreen: () => null }));
jest.mock('@screens/main/MyEventsScreen', () => ({ MyEventsScreen: () => null }));
jest.mock('@screens/main/MyFamilyScreen', () => ({ MyFamilyScreen: () => null }));
jest.mock('@screens/main/NotificationsScreen', () => ({ NotificationsScreen: () => null }));
jest.mock('@screens/main/PhotoGalleryScreen', () => ({ PhotoGalleryScreen: () => null }));
jest.mock('@screens/main/ProfileScreen', () => ({ ProfileScreen: () => null }));
jest.mock('@screens/main/RequestsScreen', () => ({ RequestsScreen: () => null }));
jest.mock('@screens/main/ReviewsScreen', () => ({ ReviewsScreen: () => null }));
jest.mock('@screens/main/SettingsScreen', () => ({ SettingsScreen: () => null }));
jest.mock('@screens/main/WebContentScreen', () => ({ WebContentScreen: () => null }));
jest.mock('@screens/main/tickets/BuyTicketScreen', () => ({ BuyTicketScreen: () => null }));
jest.mock('@screens/main/tickets/DoorScanScreen', () => ({ DoorScanScreen: () => null }));
jest.mock('@screens/main/tickets/TicketWalletScreen', () => ({ TicketWalletScreen: () => null }));
jest.mock('@screens/main/vibeQuiz/VibeQuizModalScreen', () => ({ VibeQuizModalScreen: () => null }));
jest.mock('@screens/main/vibeQuiz/VibeQuizResultsScreen', () => ({ VibeQuizResultsScreen: () => null }));

beforeEach(() => {
  mockTabNavigations.length = 0;
});

describe('primary tabs', () => {
  it('is Discover, Gatherings, Prayer, and Profile — Host is not a tab', () => {
    mockUser = { id: 1, eventLimitExempt: false, nextHostAvailableAt: new Date(Date.now() + 86400000).toISOString() };
    render(<MainNavigator />);
    expect(screen.getByText('Discover')).toBeTruthy();
    expect(screen.getByText('Gatherings')).toBeTruthy();
    expect(screen.getByText('Prayer')).toBeTruthy();
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.queryByText('Host')).toBeNull();
    expect(screen.queryByTestId('tab-Create')).toBeNull();
    expect(screen.queryByText('One gathering a week')).toBeNull();
  });
});
