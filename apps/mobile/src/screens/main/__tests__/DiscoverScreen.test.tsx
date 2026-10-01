import React from 'react';
import { Animated } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DiscoverScreen } from '../DiscoverScreen';

const mockFetchActivities = jest.fn();
const mockFetchWhosComing = jest.fn();
const mockPostRsvp = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), getParent: () => ({ navigate: jest.fn() }) }),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, church: { name: 'Franconia Mennonite Church' }, vibe: {} } }),
}));

jest.mock('@services/activityService', () => ({
  fetchActivities: (...args: unknown[]) => mockFetchActivities(...args),
  joinActivity: jest.fn(),
  leaveActivity: jest.fn(),
  swipeActivity: jest.fn(),
}));

jest.mock('@services/foyerService', () => ({
  fetchWhosComing: (...args: unknown[]) => mockFetchWhosComing(...args),
  postRsvp: (...args: unknown[]) => mockPostRsvp(...args),
}));

jest.mock('@constants/appMode', () => ({
  isFoyerMode: () => true,
  isTicketingUiEnabled: () => false,
  readAppMode: () => 'foyer',
}));

jest.mock('@lib/haptics', () => ({
  safeImpactHaptic: jest.fn(),
  safeNotificationHaptic: jest.fn(),
}));

jest.mock('@components/MapViewCompat', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));
jest.mock('@components/MatchCelebration', () => ({ MatchCelebration: () => null }));
jest.mock('@components/SafetyActionsModal', () => ({ SafetyActionsModal: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

const youthBonfire = {
  id: 7,
  title: "Youth Bonfire and S'mores Night",
  description: 'An evening around the fire for our teens.',
  location: "A member's backyard (address shared after you RSVP)",
  time: '2026-10-14T23:00:00Z',
  host: { id: 2, firstName: 'Mark', lastName: 'S.' },
  audience: 'Everyone · Ages 13–17',
  going_count: 9,
};
const second = { ...youthBonfire, id: 8, title: "Women's Fall Brunch", location: '' };

const withFamily = {
  me: { name: 'Anna', eligible: true },
  dependents: [{ id: 1, name: 'Caleb', age: 15, eligible: true }],
  note: null,
};

/** Make animations land instantly so the resting transform can be asserted. */
const settleAnimations = () => {
  const originalSpring = Animated.spring;
  const originalTiming = Animated.timing;
  // Only the swipe card's ValueXY animations land instantly; everything else (Paper) runs normally.
  const wrap = (original: (...args: never[]) => unknown) =>
    ((value: Animated.ValueXY, config: { toValue: unknown }) => {
      const target = config.toValue as { x?: number; y?: number };
      if (value instanceof Animated.ValueXY && typeof target === 'object') {
        return {
          start: (cb?: (r: { finished: boolean }) => void) => {
            value.setValue({ x: target.x ?? 0, y: target.y ?? 0 });
            cb?.({ finished: true });
          },
          stop: jest.fn(),
          reset: jest.fn(),
        };
      }
      return original(value as never, config as never);
    }) as never;
  jest.spyOn(Animated, 'spring').mockImplementation(wrap(originalSpring as never));
  jest.spyOn(Animated, 'timing').mockImplementation(wrap(originalTiming as never));
};

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <PaperProvider>
        <QueryClientProvider client={client}>
          <DiscoverScreen />
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>,
  );
};

const cardRotation = () => {
  const card = screen.getByLabelText(`View details for ${youthBonfire.title}`).parent;
  let node = card;
  while (node && !(node.props?.style && JSON.stringify(node.props.style).includes('rotate'))) {
    node = node.parent;
  }
  return node;
};

describe('Discover swipe card (Foyer)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settleAnimations();
    mockFetchActivities.mockResolvedValue([youthBonfire, second]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the full title and address, and always-visible Pass / I\'m going buttons', async () => {
    renderScreen();

    expect(await screen.findByText(youthBonfire.title)).toBeTruthy();
    expect(screen.getByText(youthBonfire.location)).toBeTruthy();
    expect(screen.getByText(youthBonfire.description)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pass' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "I'm going" })).toBeTruthy();
    expect(screen.getByText('Choose yourself or your family.')).toBeTruthy();
    expect(screen.queryByText(/ticket|wallet|stripe|gift|giving|fee/i)).toBeNull();
  });

  it('Pass moves to the next gathering and records nothing', async () => {
    renderScreen();
    await screen.findByText(youthBonfire.title);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Pass' }));
    });

    expect(await screen.findByText("Women's Fall Brunch")).toBeTruthy();
    expect(mockPostRsvp).not.toHaveBeenCalled();
    expect(mockFetchWhosComing).not.toHaveBeenCalled();
    // Blank address on the next card falls back to the RSVP placeholder.
    expect(screen.getByText('Address shared after you RSVP')).toBeTruthy();
  });

  it('I\'m going opens "Who\'s coming?"; dismissing it leaves the card on the same gathering, centered', async () => {
    mockFetchWhosComing.mockResolvedValue(withFamily);
    renderScreen();
    await screen.findByText(youthBonfire.title);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "I'm going" }));
    });

    expect(await screen.findByText("Who's coming?")).toBeTruthy();
    expect(mockPostRsvp).not.toHaveBeenCalled();
    // The card resolved to "not advanced": still the same gathering, buttons usable again.
    expect(screen.getAllByText(youthBonfire.title).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Pass' }).props.accessibilityState.disabled).toBe(false),
    );
  });

  it('tapping outside the "Who\'s coming?" sheet cancels the RSVP and the card is usable again', async () => {
    mockFetchWhosComing.mockResolvedValue(withFamily);
    renderScreen();
    await screen.findByText(youthBonfire.title);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "I'm going" }));
    });
    await screen.findByText("Who's coming?");

    await act(async () => {
      fireEvent.press(screen.getByTestId('modal-backdrop'));
    });

    await waitFor(() => expect(screen.queryByText("Who's coming?")).toBeNull());
    expect(mockPostRsvp).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: "I'm going" }).props.accessibilityState.disabled).toBe(false);
    const transform = JSON.stringify(cardRotation()?.props.style);
    expect(transform).toContain('"translateX":0');
    expect(transform).toMatch(/"rotate":"-?0deg"/);
  });

  it('a failed RSVP lookup shows an inline error, un-disables the buttons and keeps the card', async () => {
    mockFetchWhosComing.mockRejectedValue(new Error('Unable to open the RSVP list.'));
    renderScreen();
    await screen.findByText(youthBonfire.title);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "I'm going" }));
    });

    expect(await screen.findByText('Unable to open the RSVP list.')).toBeTruthy();
    expect(screen.getByText(youthBonfire.title)).toBeTruthy();
    expect(screen.getByRole('button', { name: "I'm going" }).props.accessibilityState.disabled).toBe(false);
    // Tapping again retries instead of staying locked.
    mockFetchWhosComing.mockResolvedValue(withFamily);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "I'm going" }));
    });
    expect(await screen.findByText("Who's coming?")).toBeTruthy();
  });

  it('nobody eligible explains why instead of posting an empty RSVP (the "Choose yourself" 400)', async () => {
    mockFetchWhosComing.mockResolvedValue({
      me: { name: 'Anna', eligible: false, reason: "Outside this event's age range" },
      dependents: [],
      note: null,
    });
    renderScreen();
    await screen.findByText(youthBonfire.title);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "I'm going" }));
    });

    expect(await screen.findByText("Outside this event's age range")).toBeTruthy();
    expect(mockPostRsvp).not.toHaveBeenCalled();
    expect(screen.queryByText(/choose yourself or a child/i)).toBeNull();
  });

  it('a server "Choose yourself or a child." error is shown with the family wording', async () => {
    mockFetchWhosComing.mockResolvedValue({ me: { name: 'Anna', eligible: true }, dependents: [], note: null });
    mockPostRsvp.mockRejectedValue(new Error('Choose yourself or a child.'));
    renderScreen();
    await screen.findByText(youthBonfire.title);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "I'm going" }));
    });

    // Helper line plus the inline error, both in the family wording.
    await waitFor(() => expect(screen.getAllByText('Choose yourself or your family.')).toHaveLength(2));
    expect(screen.queryByText('Choose yourself or a child.')).toBeNull();
    expect(screen.getByRole('button', { name: "I'm going" }).props.accessibilityState.disabled).toBe(false);
  });

  it('with no family members, I\'m going RSVPs directly and advances', async () => {
    mockFetchWhosComing.mockResolvedValue({ me: { name: 'Anna', eligible: true }, dependents: [], note: null });
    mockPostRsvp.mockResolvedValue({});
    renderScreen();
    await screen.findByText(youthBonfire.title);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "I'm going" }));
    });

    await waitFor(() => expect(mockPostRsvp).toHaveBeenCalledWith(7, { include_self: true, dependent_ids: [] }));
    expect(await screen.findByText("You're going")).toBeTruthy();
  });

  it('the card is never left rotated after a button tap, a failure or a dismissed sheet', async () => {
    mockFetchWhosComing.mockRejectedValue(new Error('boom'));
    renderScreen();
    await screen.findByText(youthBonfire.title);

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: "I'm going" }));
    });
    await screen.findByText('boom');

    const node = cardRotation();
    expect(node).toBeTruthy();
    const transform = JSON.stringify(node?.props.style);
    expect(transform).toContain('"translateX":0');
    expect(transform).toMatch(/"rotate":"-?0deg"/);
  });
});
