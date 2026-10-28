import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FoyerGatherings } from '../FoyerGatherings';
import { GatheringDetailScreen } from '../GatheringDetailScreen';

const mockStackNavigate = jest.fn();
const mockTabNavigate = jest.fn();
let mockUser: Record<string, unknown> = { id: 1 };
let mockRoute: { params: { activityId: number } } = { params: { activityId: 12 } };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockTabNavigate, setOptions: jest.fn(), getParent: () => ({ navigate: mockStackNavigate }) }),
  useRoute: () => mockRoute,
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@components/FoyerHeader', () => ({ FoyerHeader: () => null }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@services/activityService', () => ({ fetchHostedActivities: jest.fn(), fetchActivity: jest.fn() }));
jest.mock('@services/foyerService', () => ({ fetchGoingActivities: jest.fn(), fetchAttendees: jest.fn(), uploadGatheringPhoto: jest.fn() }));

const { fetchHostedActivities, fetchActivity } = jest.requireMock('@services/activityService') as {
  fetchHostedActivities: jest.Mock;
  fetchActivity: jest.Mock;
};
const { fetchGoingActivities, fetchAttendees } = jest.requireMock('@services/foyerService') as {
  fetchGoingActivities: jest.Mock;
  fetchAttendees: jest.Mock;
};

const wrap = (node: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, right: 0, bottom: 34, left: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </SafeAreaProvider>,
  );
};

const inFuture = new Date(Date.now() + 3 * 86_400_000).toISOString();

describe('Gatherings + opens the host flow', () => {
  beforeEach(() => {
    mockStackNavigate.mockReset();
    mockTabNavigate.mockReset();
    mockUser = { id: 1 };
    fetchHostedActivities.mockResolvedValue([]);
    fetchGoingActivities.mockResolvedValue([]);
  });

  it('opens the host screen when the weekly limit is not in effect', async () => {
    wrap(<FoyerGatherings />);
    fireEvent.press(await screen.findByLabelText('Host a gathering'));
    expect(mockTabNavigate).toHaveBeenCalledWith('Create');
    expect(screen.queryByText('One gathering a week')).toBeNull();
  });

  it('opens the weekly limit sheet instead of the host screen when blocked', async () => {
    mockUser = {
      id: 1,
      eventLimitExempt: false,
      nextHostAvailableAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    };
    wrap(<FoyerGatherings />);
    fireEvent.press(await screen.findByLabelText('Host a gathering'));
    expect(mockTabNavigate).not.toHaveBeenCalled();
    expect(screen.getByText('One gathering a week')).toBeTruthy();
  });
});

describe('Gatherings row Chat button', () => {
  beforeEach(() => {
    mockStackNavigate.mockReset();
    mockTabNavigate.mockReset();
    mockUser = { id: 1 };
  });

  it('opens that gathering (then its chat), never the hidden Chat screen', async () => {
    fetchHostedActivities.mockResolvedValue([{ id: 5, title: 'Hosted Supper', time: inFuture, host: { id: 1 } }]);
    fetchGoingActivities.mockResolvedValue([
      { id: 12, title: 'Family Game Night', time: inFuture, my_rsvp: { status: 'confirmed', people_count: 2 } },
    ]);
    wrap(<FoyerGatherings />);
    fireEvent.press(await screen.findByLabelText('Chat about Family Game Night'));
    expect(mockStackNavigate.mock.calls).toEqual([
      ['GatheringDetail', { activityId: 12 }],
      ['GatheringChat', { activityId: 12, title: 'Family Game Night' }],
    ]);
    fireEvent.press(screen.getByLabelText('Chat about Hosted Supper'));
    expect(mockStackNavigate).toHaveBeenLastCalledWith('GatheringChat', { activityId: 5, title: 'Hosted Supper' });
    expect(mockTabNavigate).not.toHaveBeenCalled();
  });

  it('shows no Chat button for a gathering you have not RSVPed to', async () => {
    fetchHostedActivities.mockResolvedValue([]);
    fetchGoingActivities.mockResolvedValue([{ id: 13, title: 'Waitlisted', time: inFuture, my_rsvp: null }]);
    wrap(<FoyerGatherings />);
    expect(await screen.findByText('Waitlisted')).toBeTruthy();
    expect(screen.queryByLabelText('Chat about Waitlisted')).toBeNull();
  });
});

describe('Gathering detail Chat pill', () => {
  beforeEach(() => {
    mockTabNavigate.mockReset();
    fetchAttendees.mockResolvedValue(null);
    mockRoute = { params: { activityId: 12 } };
  });

  it('opens this gathering\'s chat by activity id (no Chat tab)', async () => {
    fetchActivity.mockResolvedValue({
      id: 12,
      title: 'Family Game Night',
      time: inFuture,
      host: { id: 9 },
      my_rsvp: { status: 'confirmed', people_count: 1 },
    });
    wrap(<GatheringDetailScreen />);
    fireEvent.press(await screen.findByText('Chat'));
    expect(mockTabNavigate).toHaveBeenCalledTimes(1);
    expect(mockTabNavigate).toHaveBeenCalledWith('GatheringChat', { activityId: 12, title: 'Family Game Night' });
  });

  it('hides Chat unless you are going or hosting', async () => {
    fetchActivity.mockResolvedValue({ id: 12, title: 'Family Game Night', time: inFuture, host: { id: 9 }, my_rsvp: null });
    wrap(<GatheringDetailScreen />);
    expect(await screen.findByText('Photos')).toBeTruthy();
    expect(screen.queryByText('Chat')).toBeNull();
  });
});
