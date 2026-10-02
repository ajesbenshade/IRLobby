import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { AppNavigator } from '../AppNavigator';

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
jest.mock('@screens/auth/BirthDateGateScreen', () => ({ BirthDateGateScreen: () => require('react').createElement(require('react-native').Text, null, 'BIRTH GATE') }));

const signedIn = (extra: Record<string, unknown> = {}) => ({
  isAuthenticated: true,
  isInitializing: false,
  accountDeleted: false,
  needsBirthDate: false,
  user: { id: 1, onboardingCompleted: true },
  ...extra,
});

describe('AppNavigator birth-date step', () => {
  it('shows the blocking birth-date step before the app (and before onboarding)', () => {
    mockAuth = signedIn({ needsBirthDate: true, user: { id: 1, onboardingCompleted: false } });
    render(<AppNavigator />);
    expect(screen.getByText('BIRTH GATE')).toBeTruthy();
    expect(screen.queryByText('MAIN')).toBeNull();
    expect(screen.queryByText('ONBOARDING')).toBeNull();
  });

  it('goes straight to the app when no birth date is needed', () => {
    mockAuth = signedIn();
    render(<AppNavigator />);
    expect(screen.getByText('MAIN')).toBeTruthy();
    expect(screen.queryByText('BIRTH GATE')).toBeNull();
  });

  it('never shows the step to a signed-out person', () => {
    mockAuth = { isAuthenticated: false, isInitializing: false, accountDeleted: false, needsBirthDate: false, user: null };
    render(<AppNavigator />);
    expect(screen.getByText('AUTH')).toBeTruthy();
  });
});
