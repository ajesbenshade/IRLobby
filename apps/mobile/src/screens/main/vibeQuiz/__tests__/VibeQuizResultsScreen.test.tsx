import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { VibeQuizResultsScreen } from '../VibeQuizResultsScreen';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({
    params: {
      vibeProfile: 'creative_night_owl',
      vibeTags: ['art', 'deep_talks'],
      discoverTags: ['art', 'deep talks'],
    },
  }),
}));

jest.mock('@services/activityService', () => ({
  fetchActivities: jest.fn().mockResolvedValue([{ id: 1 }]),
}));

jest.mock('@hooks/useOnline', () => ({ useOnline: () => true }));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VibeQuizResultsScreen />
    </QueryClientProvider>,
  );
};

describe('VibeQuizResultsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('navigates to the Tabs route when the primary CTA is pressed', async () => {
    renderScreen();
    fireEvent.press(await screen.findByLabelText('See All My Matches →'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Tabs'));
  });

  it('navigates to Tabs when "Browse all activities" is pressed', async () => {
    renderScreen();
    fireEvent.press(await screen.findByLabelText('Browse all activities'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('Tabs'));
  });
});
