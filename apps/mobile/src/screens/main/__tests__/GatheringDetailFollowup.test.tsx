import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CANCEL_COPY, MEMBER_COPY } from '@constants/foyerCopy';
import { CANCELLED_DATE_COLOR, GatheringDetailScreen } from '../GatheringDetailScreen';

const mockNavigate = jest.fn();
let mockOptions: { headerRight?: () => React.ReactElement<any> } = {};
let mockUserId = 1;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    setOptions: (options: typeof mockOptions) => {
      mockOptions = options;
    },
  }),
  useRoute: () => ({ params: { activityId: 12 } }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: { id: mockUserId } }) }));
jest.mock('@services/activityService', () => ({ fetchActivity: jest.fn() }));
jest.mock('@services/foyerService', () => ({
  fetchAttendees: jest.fn(),
  fetchWhosComing: jest.fn(),
  postRsvp: jest.fn(),
  uploadGatheringPhoto: jest.fn(),
  reportMember: jest.fn(),
}));
jest.mock('@services/apiClient', () => ({ api: { post: jest.fn(), get: jest.fn() } }));

const { fetchActivity } = jest.requireMock('@services/activityService') as { fetchActivity: jest.Mock };
const { fetchAttendees } = jest.requireMock('@services/foyerService') as { fetchAttendees: jest.Mock };
const { api } = jest.requireMock('@services/apiClient') as { api: { post: jest.Mock } };

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <GatheringDetailScreen />
    </QueryClientProvider>,
  );
};

const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
const base = { id: 12, title: 'Family Game Night', time: future, host: { id: 9 } };
const photos = [1, 2, 3, 4, 5].map((id) => ({ id, url: `https://example.com/p${id}.jpg` }));

beforeEach(() => {
  mockNavigate.mockReset();
  mockOptions = {};
  mockUserId = 1;
  fetchActivity.mockReset();
  fetchAttendees.mockReset();
  fetchAttendees.mockResolvedValue(null);
  api.post.mockReset();
});

describe('guest cancelled view', () => {
  const cancelled = {
    ...base,
    is_cancelled: true,
    cancelled_at: '2026-10-02T15:00:00Z',
    cancel_reason: "The pavilion is booked. We'll reschedule soon.",
    my_rsvp: { status: 'confirmed', people_count: 1 },
    photos,
  };

  it('shows the Photos card with See all and the Chat card with Open chat, wired to the gallery and chat', async () => {
    fetchActivity.mockResolvedValue(cancelled);
    renderScreen();
    expect(await screen.findByTestId('cancelled-photos-card')).toBeTruthy();
    expect(screen.getByText('Photos · 5')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(CANCEL_COPY.seeAll));
    expect(mockNavigate).toHaveBeenCalledWith('PhotoGallery', { activityId: 12 });

    expect(screen.getByTestId('cancelled-chat-card')).toBeTruthy();
    expect(
      screen.getByText("Family Game Night was cancelled by the host. Reason: The pavilion is booked. We'll reschedule soon."),
    ).toBeTruthy();
    fireEvent.press(screen.getByLabelText(CANCEL_COPY.openChat));
    expect(mockNavigate).toHaveBeenCalledWith('GatheringChat', { activityId: 12, title: 'Family Game Night' });

    // The disabled pill and note stay, the old outline Photos / Chat pills are gone.
    expect(screen.getByText(CANCEL_COPY.guestNote)).toBeTruthy();
    expect(screen.queryByText('Photos')).toBeNull();
  });

  it('shows no Chat card for a guest who was not going, but still the Photos card', async () => {
    fetchActivity.mockResolvedValue({ ...cancelled, my_rsvp: null });
    renderScreen();
    expect(await screen.findByTestId('cancelled-photos-card')).toBeTruthy();
    expect(screen.queryByTestId('cancelled-chat-card')).toBeNull();
    expect(screen.queryByText(CANCEL_COPY.guestNote)).toBeNull();
  });

  it('draws the Cancelled date line in #5a5654', async () => {
    fetchActivity.mockResolvedValue(cancelled);
    renderScreen();
    const line = await screen.findByTestId('cancelled-date-line');
    expect(StyleSheet.flatten(line.props.style).color).toBe('#5a5654');
    expect(CANCELLED_DATE_COLOR).toBe('#5a5654');
  });
});

describe('host view', () => {
  beforeEach(() => {
    mockUserId = 9;
  });

  it('shows Edit and Who\'s coming together, and no cards-style cancelled guest view', async () => {
    fetchActivity.mockResolvedValue({ ...base, photos, going_count: 1 });
    fetchAttendees.mockResolvedValue({
      going_count: 1,
      households: [{ name: 'Esbenshade', people: [{ name: 'Ada', relationship: 'adult', age_band: 'adult' }] }],
    });
    renderScreen();
    expect(await screen.findByTestId('host-whos-coming')).toBeTruthy();
    // Button plus the host-only card heading.
    expect(screen.getAllByText(CANCEL_COPY.whosComing)).toHaveLength(2);
    expect(screen.getByTestId('edit-gathering')).toBeTruthy();
    expect(screen.queryByTestId('cancelled-photos-card')).toBeNull();
  });

  it('hides Who\'s coming once the gathering is cancelled', async () => {
    fetchActivity.mockResolvedValue({ ...base, is_cancelled: true, cancelled_at: '2026-10-02T15:00:00Z', photos });
    fetchAttendees.mockResolvedValue({
      going_count: 1,
      households: [{ name: 'E', people: [{ name: 'Ada', relationship: 'adult', age_band: 'adult' }] }],
    });
    renderScreen();
    expect(await screen.findByTestId('cancelled-banner')).toBeTruthy();
    expect(screen.queryByTestId('host-whos-coming')).toBeNull();
    // Host keeps Photos / Chat pills on a cancelled gathering.
    expect(screen.getByText('Photos')).toBeTruthy();
  });

  it('has no ... menu and so no Report this gathering on the host\'s own gathering', async () => {
    fetchActivity.mockResolvedValue({ ...base, photos });
    renderScreen();
    await screen.findByText('Family Game Night');
    expect(mockOptions.headerRight).toBeUndefined();
    expect(screen.queryByText(MEMBER_COPY.reportGathering)).toBeNull();
  });
});

describe('Report this gathering', () => {
  it('is offered in the ... menu to a guest and posts to /api/activities/<id>/report/ via the report adapter', async () => {
    fetchActivity.mockResolvedValue({ ...base, photos });
    api.post.mockResolvedValue({ data: { id: 1, status: 'pending' } });
    const view = renderScreen();
    await view.findByText('Family Game Night');
    await waitFor(() => expect(mockOptions.headerRight).toBeDefined());

    const menuButton = (mockOptions.headerRight as () => React.ReactElement<any>)();
    expect(menuButton.props.accessibilityLabel).toBe(MEMBER_COPY.gatheringMenuLabel);
    expect(menuButton.props.testID).toBe('gathering-menu');
    act(() => {
      menuButton.props.onPress();
    });
    fireEvent.press(await view.findByTestId('gathering-report-row'));
    expect(await view.findByText(MEMBER_COPY.reportGatheringLead)).toBeTruthy();
    fireEvent.press(view.getByLabelText('Harassment or bullying'));
    fireEvent.press(view.getByLabelText('Submit report'));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe('/api/activities/12/report/');
    expect(api.post.mock.calls[0][1]).toMatchObject({ reason: 'harassment' });
  });
});
