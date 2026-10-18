import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DELETE_GATHERING_COPY } from '@constants/foyerCopy';
import { GatheringDetailScreen } from '../GatheringDetailScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockRefreshProfile = jest.fn();
let mockUser: { id: number; eventLimitExempt?: boolean } = { id: 9 };
let mockParams: Record<string, unknown> = { activityId: 12 };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: () => undefined }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser, refreshProfile: mockRefreshProfile }) }));
jest.mock('@services/activityService', () => ({ fetchActivity: jest.fn(), deleteActivity: jest.fn() }));
jest.mock('@services/foyerService', () => ({
  fetchAttendees: jest.fn(),
  fetchWhosComing: jest.fn(),
  postRsvp: jest.fn(),
  uploadGatheringPhoto: jest.fn(),
  reportMember: jest.fn(),
}));
jest.mock('@services/apiClient', () => ({ api: { post: jest.fn(), get: jest.fn(), delete: jest.fn() } }));

const { fetchActivity, deleteActivity } = jest.requireMock('@services/activityService') as {
  fetchActivity: jest.Mock;
  deleteActivity: jest.Mock;
};
const { fetchAttendees } = jest.requireMock('@services/foyerService') as { fetchAttendees: jest.Mock };

const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
const gathering = { id: 12, title: 'Family Game Night', time: future, host: { id: 9 } };

let client: QueryClient;
const renderScreen = () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <GatheringDetailScreen />
    </QueryClientProvider>,
  );
};

const openSheet = async () => {
  fireEvent.press(await screen.findByTestId('delete-gathering'));
  return screen.getByTestId('delete-gathering-body');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 9 };
  mockParams = { activityId: 12 };
  fetchActivity.mockResolvedValue(gathering);
  fetchAttendees.mockResolvedValue(null);
  mockRefreshProfile.mockResolvedValue(null);
});

describe('host Delete gathering', () => {
  it('exempt hosts see the base sheet (frame 250)', async () => {
    mockUser = { id: 9, eventLimitExempt: true };
    renderScreen();
    const body = await openSheet();
    expect(body.props.children).toBe(DELETE_GATHERING_COPY.body);
    expect(screen.getByText(DELETE_GATHERING_COPY.title)).toBeTruthy();
  });

  it('non-exempt hosts also read the weekly-limit line (frame 253)', async () => {
    mockUser = { id: 9, eventLimitExempt: false };
    renderScreen();
    const body = await openSheet();
    expect(body.props.children).toBe(`${DELETE_GATHERING_COPY.body} ${DELETE_GATHERING_COPY.limitedLine}`);
  });

  it('Keep gathering closes without calling the API', async () => {
    renderScreen();
    await openSheet();
    fireEvent.press(screen.getByTestId('delete-gathering-keep'));
    await waitFor(() => expect(screen.queryByTestId('delete-gathering-body')).toBeNull());
    expect(deleteActivity).not.toHaveBeenCalled();
  });

  it('on 204 shows busy, invalidates lists, goes back and refreshes the profile', async () => {
    let resolve!: () => void;
    deleteActivity.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderScreen();
    await openSheet();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    fireEvent.press(screen.getByTestId('delete-gathering-confirm'));
    await waitFor(() => expect(screen.getByTestId('delete-gathering-confirm').props.accessibilityState).toMatchObject({ busy: true }));
    expect(screen.getByTestId('delete-gathering-keep').props.accessibilityState).toMatchObject({ disabled: true });
    expect(deleteActivity).toHaveBeenCalledWith(12);
    resolve();
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey[0]);
    expect(keys).toEqual(expect.arrayContaining(['mobile-discover-activities', 'foyer-hosted', 'foyer-going', 'mobile-hosted-activities']));
    expect(mockRefreshProfile).toHaveBeenCalled();
    // N6: the deleted gathering is never refetched, and the screen never flashes the unavailable state while it pops.
    expect(keys).not.toContain('foyer-gathering');
    expect(fetchActivity).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('This gathering is unavailable.')).toBeNull();
    expect(screen.getByText('Family Game Night')).toBeTruthy();
  });

  it('on error shows the plain ErrorNotice and stays open', async () => {
    deleteActivity.mockRejectedValue(Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } }));
    renderScreen();
    await openSheet();
    fireEvent.press(screen.getByTestId('delete-gathering-confirm'));
    expect(await screen.findByText("Couldn't delete the gathering. Try again.")).toBeTruthy();
    expect(screen.getByTestId('delete-gathering-error')).toBeTruthy();
    expect(screen.queryByText(/status code/)).toBeNull();
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(mockRefreshProfile).not.toHaveBeenCalled();
  });

  it('opens the 248/249 sheet passed by the host form after posting (N4)', async () => {
    mockParams = {
      activityId: 12,
      photoNotice: { title: 'This gathering is full of photos', body: 'Each gathering can hold 50 photos. Remove one to add another.' },
    };
    renderScreen();
    expect(await screen.findByTestId('photo-limit-title')).toBeTruthy();
    expect(screen.getByText('This gathering is full of photos')).toBeTruthy();
    fireEvent.press(screen.getByTestId('photo-limit-ok'));
    await waitFor(() => expect(screen.queryByTestId('photo-limit-title')).toBeNull());
  });

  it('Delete is a red outline pill, not solid', async () => {
    renderScreen();
    const style = StyleSheet.flatten((await screen.findByTestId('delete-gathering')).props.style);
    expect(style.borderColor).toBe('#8a0a1f');
    expect(style.backgroundColor).not.toBe('#8a0a1f');
    expect(style.borderWidth).toBeGreaterThan(0);
  });

  it('non-hosts do not see Delete gathering', async () => {
    mockUser = { id: 1 };
    renderScreen();
    expect(await screen.findByText('Family Game Night')).toBeTruthy();
    expect(screen.queryByTestId('delete-gathering')).toBeNull();
  });
});
