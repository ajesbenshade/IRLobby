import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { AppNavigator, linking } from '../AppNavigator';
import { markChurchStepDone, resetFirstRunState } from '@foyer/firstRun';

let mockAuth: Record<string, unknown> = {};

jest.mock('@hooks/useAuth', () => ({ useAuth: () => mockAuth }));
jest.mock('@react-navigation/native', () => ({
  DefaultTheme: { colors: {} },
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  getStateFromPath: jest.fn(),
}));
// Renders only the first (active) screen of the navigator, which is what the user would see.
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
jest.mock('expo-linking', () => ({ createURL: () => 'exp://' }));
jest.mock('@services/pushNotificationNavigation', () => ({
  useNavigationContainerRef: () => ({}),
  usePushNotificationNavigation: jest.fn(),
}));
jest.mock('../AuthNavigator', () => ({ AuthNavigator: () => require('react').createElement(require('react-native').Text, null, 'AUTH') }));
jest.mock('../MainNavigator', () => ({ MainNavigator: () => require('react').createElement(require('react-native').Text, null, 'MAIN') }));
jest.mock('@screens/main/OnboardingScreen', () => ({ OnboardingScreen: () => require('react').createElement(require('react-native').Text, null, 'ONBOARDING') }));
jest.mock('@screens/auth/AccountDeletedScreen', () => ({ AccountDeletedScreen: () => require('react').createElement(require('react-native').Text, null, 'DELETED') }));
jest.mock('@screens/auth/FoyerChurchStepScreen', () => ({ FoyerChurchStepScreen: () => require('react').createElement(require('react-native').Text, null, 'CHURCH STEP') }));
jest.mock('@screens/auth/BirthDateGateScreen', () => ({ BirthDateGateScreen: () => require('react').createElement(require('react-native').Text, null, 'BIRTH GATE') }));

const signedIn = (extra: Record<string, unknown> = {}) => ({
  isAuthenticated: true,
  isInitializing: false,
  accountDeleted: false,
  needsBirthDate: false,
  user: { id: 1, onboardingCompleted: true },
  ...extra,
});


describe('AppNavigator first run (Foyer)', () => {
  const previousMode = process.env.EXPO_PUBLIC_APP_MODE;
  beforeEach(() => resetFirstRunState());
  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = previousMode;
  });

  it('a new Foyer account (server says onboardingCompleted: false) gets the church step, never the legacy onboarding', () => {
    mockAuth = signedIn({ user: { id: 1, onboardingCompleted: false } });
    render(<AppNavigator />);
    expect(screen.getByText('CHURCH STEP')).toBeTruthy();
    expect(screen.queryByText('ONBOARDING')).toBeNull();
  });

  it('leaving the church step goes straight to the app even before the profile refresh lands', () => {
    mockAuth = signedIn({ user: { id: 1, onboardingCompleted: false } });
    render(<AppNavigator />);
    act(() => markChurchStepDone());
    expect(screen.getByText('MAIN')).toBeTruthy();
    expect(screen.queryByText('ONBOARDING')).toBeNull();
  });

  it('onboarded accounts go straight to the app', () => {
    mockAuth = signedIn();
    render(<AppNavigator />);
    expect(screen.getByText('MAIN')).toBeTruthy();
  });

  it('legacy irlobby mode still shows its onboarding', () => {
    process.env.EXPO_PUBLIC_APP_MODE = 'irlobby';
    mockAuth = signedIn({ user: { id: 1, onboardingCompleted: false } });
    render(<AppNavigator />);
    expect(screen.getByText('ONBOARDING')).toBeTruthy();
    expect(screen.queryByText('CHURCH STEP')).toBeNull();
  });

  it('Foyer deep links: no legacy chat or Pings feed routes', () => {
    const main = (linking.config?.screens as Record<string, { screens: Record<string, unknown> }>).Main.screens;
    expect('Notifications' in main).toBe(false);
    const tabs = (main.Tabs as { screens: Record<string, string> }).screens;
    expect('Chat' in tabs).toBe(false);
    expect('Create' in tabs).toBe(false);
    expect(main.Create).toBe('create');
    expect(main.GatheringChat).toBe('gatherings/:activityId/chat');
    expect(main.GatheringDetail).toBe('gatherings/:activityId');
  });
});
