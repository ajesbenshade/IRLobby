import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CreateActivityScreen } from '../CreateActivityScreen';
import {
  CREATE_EVENT_PUBLISH_LABEL,
  CREATE_EVENT_TICKETED_PUBLISH_LABEL,
} from '../createActivityForm';
import { EVENT_PHOTOS_HELPER } from '@constants/activity';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    canGoBack: () => false,
  }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: { canSellTickets: false },
    refreshProfile: jest.fn(),
  }),
}));

jest.mock('@services/paymentService', () => ({
  fetchStripeConnectStatus: jest.fn().mockResolvedValue({
    available: false,
    connected: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    onboardingComplete: false,
  }),
  openStripeConnectOnboarding: jest.fn(),
}));

jest.mock('@services/activityService', () => ({
  createActivity: jest.fn(),
  updateActivity: jest.fn(),
  fetchActivity: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock('@utils/profileImages', () => ({
  imageAssetToUploadDataUrl: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, enabled: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CreateActivityScreen />
    </QueryClientProvider>,
  );
};

describe('CreateActivityScreen ticketed toggle', () => {
  it('defaults to a non-ticketed event with ticket fields hidden and Publish as the CTA', async () => {
    renderScreen();

    const ticketedToggle = await screen.findByLabelText('Ticketed event');
    expect(ticketedToggle.props.value).toBe(false);
    expect(screen.queryByLabelText('Ticket price')).toBeNull();
    expect(screen.queryByText('Require QR check-in')).toBeNull();
    expect(screen.queryByText(/IRLobby takes 10%/)).toBeNull();
    expect(screen.getByText(CREATE_EVENT_PUBLISH_LABEL)).toBeTruthy();
    expect(screen.queryByText(CREATE_EVENT_TICKETED_PUBLISH_LABEL)).toBeNull();
  });

  it('reveals ticket fields and the ticketed publish CTA when the toggle is on', async () => {
    renderScreen();

    fireEvent(await screen.findByLabelText('Ticketed event'), 'valueChange', true);

    await waitFor(() => {
      expect(screen.getByLabelText('Ticket price')).toBeTruthy();
    });
    expect(screen.getByLabelText('Capacity')).toBeTruthy();
    expect(screen.getByText('Require QR check-in')).toBeTruthy();
    expect(screen.getByText(/IRLobby takes 10%/)).toBeTruthy();
    expect(screen.getByText(CREATE_EVENT_TICKETED_PUBLISH_LABEL)).toBeTruthy();
    expect(screen.queryByText(CREATE_EVENT_PUBLISH_LABEL)).toBeNull();
  });
});

describe('CreateActivityScreen photos (Frame A2)', () => {
  it('shows the photos section above the ticketed toggle with five empty slots', async () => {
    renderScreen();

    expect(await screen.findByText('Photos')).toBeTruthy();
    expect(screen.getByText(EVENT_PHOTOS_HELPER)).toBeTruthy();
    expect(screen.getAllByLabelText('Add photo')).toHaveLength(5);
    expect(screen.queryByText('Pick up to 5 images')).toBeNull();
  });

  it('fills a slot from the system picker and can remove it', async () => {
    const ImagePicker = jest.requireMock('expo-image-picker') as {
      requestMediaLibraryPermissionsAsync: jest.Mock;
      launchImageLibraryAsync: jest.Mock;
    };
    const { imageAssetToUploadDataUrl } = jest.requireMock('@utils/profileImages') as {
      imageAssetToUploadDataUrl: jest.Mock;
    };

    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://sunset.jpg', mimeType: 'image/jpeg', width: 200, height: 200 }],
    });
    imageAssetToUploadDataUrl.mockResolvedValue('data:image/jpeg;base64,abc');

    renderScreen();
    fireEvent.press((await screen.findAllByLabelText('Add photo'))[0]);

    await waitFor(() => {
      expect(screen.getByLabelText('Remove photo 1')).toBeTruthy();
    });
    expect(screen.getAllByLabelText('Add photo')).toHaveLength(4);

    fireEvent.press(screen.getByLabelText('Remove photo 1'));
    expect(screen.getAllByLabelText('Add photo')).toHaveLength(5);
  });
});
