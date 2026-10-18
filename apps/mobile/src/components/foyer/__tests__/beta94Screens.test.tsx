import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PickChurchCard } from '@components/foyer/PickChurchCard';
import { DeleteGatheringSheet } from '@components/foyer/DeleteGatheringSheet';
import { EventLimitSheet } from '@components/foyer/EventLimitSheet';
import { PICK_CHURCH_DISMISSED_KEY, isFoyerWelcomeActive, resetFirstRunState, needsFoyerChurchStep } from '@foyer/firstRun';
import { ErrorBoundary } from '@providers/ErrorBoundary';
import { FoyerChurchStepScreen } from '@screens/auth/FoyerChurchStepScreen';
import { FoyerHostEntry } from '@screens/main/FoyerHostLimit';
import { api } from '@services/apiClient';
import { updateOnboarding } from '@services/authService';

const mockRefresh = jest.fn();
let mockUser: Record<string, unknown> = {};

jest.mock('@hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser, refreshProfile: mockRefresh }) }));
jest.mock('@services/apiClient', () => ({ api: { patch: jest.fn(), get: jest.fn() } }));
jest.mock('@services/authService', () => ({ updateOnboarding: jest.fn() }));
jest.mock('@services/foyerService', () => ({
  fetchChurches: jest.fn(async () => [
    { id: 3, name: 'Blooming Glen Mennonite' },
    { id: 4, name: 'Franconia Mennonite' },
  ]),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));
jest.mock('@components/FoyerHeader', () => ({ FoyerHeader: () => null }));
jest.mock('@screens/main/FoyerHostForm', () => ({
  FoyerHostForm: () => require('react').createElement(require('react-native').Text, null, 'HOST FORM'),
}));
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return {
    SafeAreaView: RN.View,
    SafeAreaInsetsContext: require('react').createContext({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  };
});

const wrap = (node: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
};

beforeEach(async () => {
  jest.clearAllMocks();
  resetFirstRunState();
  await AsyncStorage.clear();
  (api.patch as jest.Mock).mockResolvedValue({ data: {} });
  (updateOnboarding as jest.Mock).mockResolvedValue(undefined);
  mockRefresh.mockResolvedValue(null);
  mockUser = { id: 1, onboardingCompleted: false, churchId: null, activityPreferences: {} };
});

describe('church step (frames 242-244)', () => {
  it('shows Design copy, and Continue stays disabled until a church is picked', async () => {
    wrap(<FoyerChurchStepScreen />);
    expect(screen.getByText('Which church do you attend?')).toBeTruthy();
    expect(screen.getByText("We'll show you gatherings and people from your church. You can change this later in Profile.")).toBeTruthy();
    expect(screen.getByPlaceholderText('Search churches')).toBeTruthy();
    expect(screen.getByText('Skip for now')).toBeTruthy();
    expect(screen.getByTestId('church-step-continue').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(await screen.findByTestId('church-option-4'));
    expect(screen.getByTestId('church-option-4').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('church-step-continue').props.accessibilityState.disabled).toBe(false);
  });

  it('Continue saves church_id via PATCH /api/users/profile/, finishes onboarding without the quiz and opens on Profile', async () => {
    wrap(<FoyerChurchStepScreen />);
    fireEvent.press(await screen.findByTestId('church-option-4'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('church-step-continue'));
    });
    expect(api.patch).toHaveBeenCalledWith('/api/users/profile/', { church_id: 4 });
    expect(updateOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({ onboarding_completed: true, activity_preferences: { vibe: { vibeQuizSkipped: true } } }),
    );
    expect(mockRefresh).toHaveBeenCalled();
    expect(isFoyerWelcomeActive()).toBe(true);
    // Even if the profile refresh failed, the step can't trap them.
    expect(needsFoyerChurchStep(mockUser as never, true)).toBe(false);
  });

  it('Skip for now saves no church but still finishes onboarding', async () => {
    wrap(<FoyerChurchStepScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('church-step-skip'));
    });
    expect(api.patch).not.toHaveBeenCalled();
    expect(updateOnboarding).toHaveBeenCalled();
  });

  it('a failed onboarding PATCH still lets them in (no trap)', async () => {
    (updateOnboarding as jest.Mock).mockRejectedValue(new Error('400'));
    wrap(<FoyerChurchStepScreen />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('church-step-skip'));
    });
    expect(needsFoyerChurchStep(mockUser as never, true)).toBe(false);
  });

  it('a failed church save shows an error and stays on the step', async () => {
    (api.patch as jest.Mock).mockRejectedValue(new Error('500'));
    wrap(<FoyerChurchStepScreen />);
    fireEvent.press(await screen.findByTestId('church-option-3'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('church-step-continue'));
    });
    expect(screen.getByText("Couldn't save your church. Please try again.")).toBeTruthy();
    expect(updateOnboarding).not.toHaveBeenCalled();
    expect(needsFoyerChurchStep(mockUser as never, true)).toBe(true);
  });

  it("My church isn't listed opens the sheet with the email note and OK", async () => {
    wrap(<FoyerChurchStepScreen />);
    fireEvent.press(screen.getByTestId('church-not-listed'));
    expect(screen.getByTestId('church-not-listed-title').props.children).toBe("My church isn't listed");
    expect(screen.getByTestId('church-not-listed-body').props.children).toBe(
      "The Foyer is being tested with a few Mennonite churches right now. Email support@irlobby.com and we'll look at adding yours.",
    );
    fireEvent.press(screen.getByTestId('church-not-listed-ok'));
    await waitFor(() => expect(screen.queryByTestId('church-not-listed-body')).toBeNull());
  });
});

describe('Pick your church card (frame 245)', () => {
  it('shows on Discover with no church; Not now hides it there and is remembered on the device', async () => {
    wrap(<PickChurchCard surface="discover" />);
    expect(await screen.findByText('Pick your church')).toBeTruthy();
    expect(screen.getByText('See gatherings from your congregation.')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('pick-church-not-now'));
    });
    expect(screen.queryByTestId('pick-church-card-discover')).toBeNull();
    expect(await AsyncStorage.getItem(PICK_CHURCH_DISMISSED_KEY)).toBe('true');
  });

  it('once dismissed it shows on Profile only', async () => {
    await AsyncStorage.setItem(PICK_CHURCH_DISMISSED_KEY, 'true');
    const discover = wrap(<PickChurchCard surface="discover" />);
    await act(async () => undefined);
    expect(screen.queryByTestId('pick-church-card-discover')).toBeNull();
    discover.unmount();
    wrap(<PickChurchCard surface="profile" />);
    expect(await screen.findByTestId('pick-church-card-profile')).toBeTruthy();
  });

  it('never shows once the member has a church', async () => {
    mockUser = { ...mockUser, churchId: 4 };
    wrap(<PickChurchCard surface="profile" />);
    await act(async () => undefined);
    expect(screen.queryByText('Pick your church')).toBeNull();
  });

  it('Choose church opens the picker and saves church_id the same way', async () => {
    wrap(<PickChurchCard surface="profile" />);
    fireEvent.press(await screen.findByTestId('pick-church-choose'));
    expect(screen.getByTestId('church-sheet-save').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(await screen.findByTestId('church-option-4'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('church-sheet-save'));
    });
    expect(api.patch).toHaveBeenCalledWith('/api/users/profile/', { church_id: 4 });
    expect(mockRefresh).toHaveBeenCalled();
  });
});

describe('weekly host limit on the Host tab and the 429 sheet (frames 246-247)', () => {
  it('a future next_host_available_at shows the note instead of the form', () => {
    const opens = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    mockUser = { ...mockUser, eventLimitExempt: false, nextHostAvailableAt: opens.toISOString() };
    render(<FoyerHostEntry />);
    expect(screen.queryByText('HOST FORM')).toBeNull();
    expect(screen.getByTestId('host-limit-banner')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toMatch(
      /You can host one gathering a week\. Your next one opens \w{3}, \w{3} \d{1,2} at \d{1,2}:\d{2} (AM|PM)\./,
    );
  });

  it('exempt members, missing fields and editing always get the form', () => {
    const opens = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    mockUser = { ...mockUser, eventLimitExempt: true, nextHostAvailableAt: opens };
    const a = render(<FoyerHostEntry />);
    expect(screen.getByText('HOST FORM')).toBeTruthy();
    a.unmount();
    mockUser = { id: 1 };
    const b = render(<FoyerHostEntry />);
    expect(screen.getByText('HOST FORM')).toBeTruthy();
    b.unmount();
    mockUser = { ...mockUser, eventLimitExempt: false, nextHostAvailableAt: opens };
    render(<FoyerHostEntry activityId={9} />);
    expect(screen.getByText('HOST FORM')).toBeTruthy();
  });

  it('the One gathering a week sheet uses Design copy with the local date and time', () => {
    const onClose = jest.fn();
    render(<EventLimitSheet visible nextAllowedAt={new Date(2026, 9, 25, 10, 22)} onClose={onClose} />);
    expect(screen.getByTestId('event-limit-title').props.children).toBe('One gathering a week');
    expect(screen.getByTestId('event-limit-body').props.children).toBe(
      'Members can host one gathering each week. You can start your next one on Sunday, Oct 25 at 10:22 AM, or ask a church admin to post it for you.',
    );
    fireEvent.press(screen.getByTestId('event-limit-ok'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('delete gathering sheet (frames 250 / -limited)', () => {
  it('non-exempt host body adds the weekly-limit line; exempt host sees it as drawn; buttons per frame', () => {
    const limited = render(<DeleteGatheringSheet visible eventLimitExempt={false} onDelete={jest.fn()} onKeep={jest.fn()} />);
    expect(screen.getByText('Delete this gathering?')).toBeTruthy();
    expect(screen.getByTestId('delete-gathering-body').props.children).toMatch(/save them first\. Deleting it won't let you host another gathering this week\.$/);
    expect(screen.getByText('Delete gathering')).toBeTruthy();
    expect(screen.getByText('Keep gathering')).toBeTruthy();
    limited.unmount();
    render(<DeleteGatheringSheet visible eventLimitExempt onDelete={jest.fn()} onKeep={jest.fn()} />);
    expect(screen.getByTestId('delete-gathering-body').props.children).toMatch(/save them first\.$/);
  });
});

describe('crash screen (frame 252)', () => {
  const Boom = () => {
    throw new Error('TypeError: secret internals');
  };

  it('shows plain copy, no raw error and no "team has been notified"', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Close and reopen The Foyer. If it keeps happening, tap Send feedback in Settings.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    const text = JSON.stringify(screen.toJSON());
    expect(text).not.toMatch(/secret internals|notified|Hiccup/);
  });

  it('Try again re-renders the children', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let explode = true;
    const Maybe = () => {
      if (explode) {
        throw new Error('x');
      }
      return <Text>BACK</Text>;
    };
    render(
      <ErrorBoundary>
        <Maybe />
      </ErrorBoundary>,
    );
    explode = false;
    fireEvent.press(screen.getByTestId('crash-try-again'));
    expect(screen.getByText('BACK')).toBeTruthy();
  });
});
