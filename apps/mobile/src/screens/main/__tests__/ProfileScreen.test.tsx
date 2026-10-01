import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ProfileScreen } from '../ProfileScreen';

const mockRefreshProfile = jest.fn().mockResolvedValue(undefined);
const mockSignOut = jest.fn();
const mockPatch = jest.fn().mockResolvedValue({});
const mockUpdateOnboarding = jest.fn().mockResolvedValue({});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), getState: () => ({ routeNames: [] }) }),
}));

// Stable reference: ProfileScreen resets its form in an effect keyed on `user`.
const mockUser = {
  id: 1,
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  bio: '',
  city: '',
  avatarUrl: '',
  interests: [] as string[],
  photoAlbum: [] as string[],
};

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
    refreshProfile: mockRefreshProfile,
  }),
}));

jest.mock('@services/apiClient', () => ({
  api: { patch: (...args: unknown[]) => mockPatch(...args) },
}));

jest.mock('@services/authService', () => ({
  updateOnboarding: (...args: unknown[]) => mockUpdateOnboarding(...args),
}));

jest.mock('expo-image-picker', () => ({}));

jest.mock('@components/ProfileCompletionRing', () => ({ ProfileCompletionRing: () => null }));

// The legacy Profile layout renders only outside Foyer mode; each test picks its mode.
const mockIsFoyerMode = jest.fn(() => false);
jest.mock('@constants/appMode', () => ({
  ...jest.requireActual('@constants/appMode'),
  isFoyerMode: () => mockIsFoyerMode(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfileScreen />
    </QueryClientProvider>,
  );
};

describe('ProfileScreen (legacy layout, not Foyer mode)', () => {
  beforeEach(() => {
    mockIsFoyerMode.mockReturnValue(false);
    mockRefreshProfile.mockClear();
    mockPatch.mockClear();
    mockUpdateOnboarding.mockClear();
  });

  it('no longer offers adding a photo by URL', () => {
    renderScreen();

    expect(screen.queryByText('Photo URL')).toBeNull();
    expect(screen.queryByLabelText('Photo URL')).toBeNull();
  });

  it('keeps the library picker, 12-photo counter and empty state', () => {
    renderScreen();

    expect(screen.getByText('Add from library')).toBeTruthy();
    expect(screen.getByText('Photo album (0/12)')).toBeTruthy();
    expect(screen.getByText('No photos yet')).toBeTruthy();
  });

  it('replaces the Actions card with a plain Save button', async () => {
    renderScreen();

    expect(screen.queryByText('Keep it current')).toBeNull();
    expect(screen.queryByText('Save glow-up')).toBeNull();
    expect(screen.queryByText('Refresh')).toBeNull();

    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockUpdateOnboarding).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalledTimes(1));
  });

  it('refreshes the profile via pull-to-refresh', async () => {
    renderScreen();

    const scroll = screen.UNSAFE_getByType(require('react-native').ScrollView);
    const refreshControl = scroll.props.refreshControl;
    expect(refreshControl).toBeTruthy();

    await act(async () => {
      refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalledTimes(1));
  });
});

describe('ProfileScreen (Foyer mode)', () => {
  beforeEach(() => {
    mockIsFoyerMode.mockReturnValue(true);
    mockRefreshProfile.mockClear();
  });

  afterEach(() => {
    mockIsFoyerMode.mockReturnValue(false);
  });

  it('shows the Foyer profile with Settings, Account, Help and Log out, and no legacy sections', () => {
    renderScreen();

    expect(screen.getByLabelText('Settings')).toBeTruthy();
    expect(screen.getByLabelText('Account')).toBeTruthy();
    expect(screen.getByLabelText('Help')).toBeTruthy();
    expect(screen.getByLabelText('Log out')).toBeTruthy();
    expect(screen.getByText('Church calendar')).toBeTruthy();
    expect(screen.queryByText('Photo album (0/12)')).toBeNull();
    expect(screen.queryByText('Starter avatars')).toBeNull();
    expect(screen.queryByLabelText('Connections')).toBeNull();
  });

  it('refreshes the profile by pulling down', async () => {
    renderScreen();

    const scroll = screen.UNSAFE_getByType(require('react-native').ScrollView);
    expect(scroll.props.refreshControl).toBeTruthy();

    await act(async () => {
      scroll.props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalledTimes(1));
  });
});
