import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FriendsScreen } from '../FriendsScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockFetchConnections = jest.fn();
const mockIsFoyerMode = jest.fn(() => true);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

jest.mock('@constants/appMode', () => ({
  isFoyerMode: () => mockIsFoyerMode(),
}));

jest.mock('@services/connectionsService', () => ({
  fetchConnections: () => mockFetchConnections(),
}));

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FriendsScreen />
    </QueryClientProvider>,
  );
};

const sample = {
  unavailable: false,
  gathering: [
    {
      userId: 4,
      displayName: 'Maria K.',
      avatarUrl: null,
      contextTitle: 'Youth bonfire',
      contextKind: 'gathering' as const,
      contextId: 9,
      contextDate: '2026-10-17',
      contextDateLabel: null,
      profileVisible: true,
    },
  ],
  praying: [
    {
      userId: null,
      displayName: 'Jonah S.',
      avatarUrl: null,
      contextTitle: "Dad's surgery",
      contextKind: 'prayer' as const,
      contextId: 3,
      contextDate: null,
      contextDateLabel: null,
      profileVisible: false,
    },
  ],
};

describe('Connections screen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGoBack.mockReset();
    mockFetchConnections.mockReset();
    mockIsFoyerMode.mockReturnValue(true);
  });

  it('shows both sections, including their empty copy, and no message action', async () => {
    mockFetchConnections.mockResolvedValue({ unavailable: true, gathering: [], praying: [] });
    renderScreen();

    expect(await screen.findByText('Gathering with (0)')).toBeTruthy();
    expect(screen.getByText('People you’re gathering with or praying for.')).toBeTruthy();
    expect(screen.getByText('Praying for (0)')).toBeTruthy();
    expect(screen.getByText('No gatherings with others yet.')).toBeTruthy();
    expect(screen.getByText('When you and someone else are both going to a gathering, they’ll show up here.')).toBeTruthy();
    expect(screen.getByText('You’re not praying with anyone yet.')).toBeTruthy();
    expect(screen.getByText('Tap I’m praying on a prayer request to connect here.')).toBeTruthy();
    expect(screen.queryByText('Message')).toBeNull();
    expect(screen.queryByText(/message me/i)).toBeNull();
  });

  it('opens a member profile from a gathering row and prayer detail when there is no profile', async () => {
    mockFetchConnections.mockResolvedValue(sample);
    renderScreen();

    fireEvent.press(await screen.findByLabelText('Maria K., Youth bonfire · Sat Oct 17'));
    expect(mockNavigate).toHaveBeenCalledWith('MemberProfile', { userId: 4 });

    fireEvent.press(screen.getByLabelText("Jonah S., Praying for: Dad's surgery"));
    expect(mockNavigate).toHaveBeenCalledWith('PrayerDetail', { prayerId: 3 });
    expect(mockNavigate).not.toHaveBeenCalledWith('DirectChat', expect.anything());
  });

  it('shows the load error and retries', async () => {
    mockFetchConnections.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(sample);
    renderScreen();

    expect(await screen.findByText('Unable to load connections.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Retry'));
    expect(await screen.findByText('Gathering with (1)')).toBeTruthy();
    expect(screen.getByText('Praying for (1)')).toBeTruthy();
  });

  it('keeps the intro when the native header already titles the screen', async () => {
    mockIsFoyerMode.mockReturnValue(false);
    mockFetchConnections.mockResolvedValue({ unavailable: true, gathering: [], praying: [] });
    renderScreen();

    expect(await screen.findByText('Gathering with (0)')).toBeTruthy();
    expect(screen.getByText('People you’re gathering with or praying for.')).toBeTruthy();
    expect(screen.queryByText('Profile')).toBeNull();
  });
});
