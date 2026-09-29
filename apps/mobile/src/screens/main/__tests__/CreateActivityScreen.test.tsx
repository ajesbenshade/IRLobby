import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CreateActivityScreen } from '../CreateActivityScreen';
import {
  CREATE_EVENT_PUBLISH_LABEL,
  CREATE_EVENT_TICKETED_PUBLISH_LABEL,
} from '../createActivityForm';
import { EVENT_PHOTOS_HELPER } from '@constants/activity';
import { PROTOTYPE_FOOTER_HOST } from '@constants/tickets';

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

jest.mock('@constants/config', () => {
  const actual = jest.requireActual('@constants/config');
  return { ...actual, config: { ...actual.config, ticketingEnabled: true } };
});

const mockConfig = (jest.requireMock('@constants/config') as { config: { ticketingEnabled: boolean } })
  .config;

beforeEach(() => {
  mockConfig.ticketingEnabled = true;
});

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

jest.mock('@services/foyerService', () => ({
  uploadGatheringPhoto: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  manipulateAsync: jest.fn(async (uri: string) => ({ uri })),
}));

describe('CreateActivityScreen in foyer mode', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = 'foyer';
  });

  it('hides the ticketed toggle, fee preview, and 10% copy even when ticketing is enabled', async () => {
    renderScreen();

    expect(await screen.findByText('Add a cover photo')).toBeTruthy();
    expect(screen.queryByLabelText('Ticketed event')).toBeNull();
    expect(screen.queryByLabelText('Ticket price')).toBeNull();
    expect(screen.queryByText('Require QR check-in')).toBeNull();
    expect(screen.queryByText(/takes 10%/)).toBeNull();
    expect(screen.queryByText('Set up payouts')).toBeNull();
    expect(screen.getByText('Post gathering')).toBeTruthy();
    expect(screen.queryByText(CREATE_EVENT_TICKETED_PUBLISH_LABEL)).toBeNull();
    expect(screen.getByText(/Don't list a home address/)).toBeTruthy();
  });

  it('rejects a capacity outside 1–500 and accepts a blank unlimited capacity', async () => {
    const { createActivity } = jest.requireMock('@services/activityService') as {
      createActivity: jest.Mock;
    };
    createActivity.mockResolvedValue({ id: 9 });
    renderScreen();

    fireEvent.changeText(await screen.findByLabelText('Title'), 'Harvest Supper');
    fireEvent.changeText(screen.getByLabelText('Place'), 'Fellowship Hall');
    fireEvent.changeText(screen.getByLabelText('Date & time'), '2026-11-07T17:30:00');
    fireEvent.changeText(screen.getByLabelText('Capacity'), '501');
    fireEvent.press(screen.getByText('Post gathering'));
    expect(await screen.findByText('Capacity must be a whole number from 1 to 500.')).toBeTruthy();
    expect(createActivity).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Capacity'), '');
    fireEvent.press(screen.getByText('Post gathering'));
    await waitFor(() => {
      expect(createActivity).toHaveBeenCalledWith(expect.objectContaining({ capacity: null }));
    });
  });
});

describe('CreateActivityScreen ticketed toggle when app mode is irlobby', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = 'irlobby';
    mockConfig.ticketingEnabled = true;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = 'foyer';
  });

  it('defaults to a non-ticketed event with ticket fields hidden and Publish as the CTA', async () => {
    renderScreen();

    const ticketedToggle = await screen.findByLabelText('Ticketed event');
    expect(ticketedToggle.props.value).toBe(false);
    expect(screen.queryByLabelText('Ticket price')).toBeNull();
    expect(screen.queryByText('Require QR check-in')).toBeNull();
    expect(screen.queryByText(/The Foyer takes 10%/)).toBeNull();
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
    expect(screen.getByText(/The Foyer takes 10%/)).toBeTruthy();
    expect(screen.getByText(CREATE_EVENT_TICKETED_PUBLISH_LABEL)).toBeTruthy();
    expect(screen.queryByText(CREATE_EVENT_PUBLISH_LABEL)).toBeNull();
  });
});

describe('CreateActivityScreen with ticketing disabled', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = 'irlobby';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = 'foyer';
  });

  it('hides the ticketed toggle, payouts button, and prototype footer', async () => {
    mockConfig.ticketingEnabled = false;
    renderScreen();

    expect(await screen.findByText('Photos')).toBeTruthy();
    expect(screen.queryByLabelText('Ticketed event')).toBeNull();
    expect(screen.queryByText('Set up payouts')).toBeNull();
    expect(screen.queryByText(PROTOTYPE_FOOTER_HOST)).toBeNull();
    expect(screen.getByText(CREATE_EVENT_PUBLISH_LABEL)).toBeTruthy();
  });
});

describe('CreateActivityScreen photos (Frame A2)', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = 'irlobby';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_APP_MODE = 'foyer';
  });

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
