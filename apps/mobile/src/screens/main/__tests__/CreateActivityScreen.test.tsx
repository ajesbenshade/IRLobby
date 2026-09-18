import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CreateActivityScreen } from '../CreateActivityScreen';
import {
  CREATE_EVENT_PUBLISH_LABEL,
  CREATE_EVENT_TICKETED_PUBLISH_LABEL,
} from '../createActivityForm';

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
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CreateActivityScreen />
    </QueryClientProvider>,
  );
};

describe('CreateActivityScreen ticketed toggle', () => {
  it('defaults to a non-ticketed event with ticket fields hidden and Publish as the CTA', () => {
    renderScreen();

    expect(screen.getByLabelText('Ticketed event')).toHaveProp('value', false);
    expect(screen.queryByLabelText('Ticket price')).toBeNull();
    expect(screen.queryByText('Require QR check-in')).toBeNull();
    expect(screen.queryByText(/IRLobby takes 10%/)).toBeNull();
    expect(screen.getByText(CREATE_EVENT_PUBLISH_LABEL)).toBeTruthy();
    expect(screen.queryByText(CREATE_EVENT_TICKETED_PUBLISH_LABEL)).toBeNull();
  });

  it('reveals ticket fields and the ticketed publish CTA when the toggle is on', () => {
    renderScreen();

    fireEvent(screen.getByLabelText('Ticketed event'), 'valueChange', true);

    expect(screen.getByLabelText('Ticket price')).toBeTruthy();
    expect(screen.getByLabelText('Capacity')).toBeTruthy();
    expect(screen.getByText('Require QR check-in')).toBeTruthy();
    expect(screen.getByText(/IRLobby takes 10%/)).toBeTruthy();
    expect(screen.getByText(CREATE_EVENT_TICKETED_PUBLISH_LABEL)).toBeTruthy();
    expect(screen.queryByText(CREATE_EVENT_PUBLISH_LABEL)).toBeNull();
  });
});
