import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactTestInstance } from 'react-test-renderer';

import { GET_PAID_COPY } from '@constants/tickets';
import { GetPaidScreen } from '../GetPaidScreen';
import { openStripeConnectOnboarding } from '@services/paymentService';

const mockGoBack = jest.fn();
const mockRefreshProfile = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    canGoBack: () => true,
    navigate: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: { canSellTickets: false },
    refreshProfile: mockRefreshProfile,
  }),
}));

jest.mock('@services/paymentService', () => {
  const actual = jest.requireActual('@services/paymentService');
  return {
    ...actual,
    fetchStripeConnectStatus: jest.fn(),
    openStripeConnectOnboarding: jest.fn(),
  };
});

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const { fetchStripeConnectStatus } = jest.requireMock('@services/paymentService') as {
  fetchStripeConnectStatus: jest.Mock;
};

const ancestorTestIds = (node: ReactTestInstance) => {
  const ids: string[] = [];
  let current: ReactTestInstance | null = node.parent;
  while (current) {
    if (typeof current.props.testID === 'string') {
      ids.push(current.props.testID);
    }
    current = current.parent;
  }
  return ids;
};

const collectText = (node: ReactTestInstance) => {
  const texts: string[] = [];
  const walk = (current: ReactTestInstance) => {
    const children = current.children;
    if (typeof current.props.children === 'string') {
      texts.push(current.props.children);
    }
    children.forEach((child) => {
      if (typeof child !== 'string') {
        walk(child);
      }
    });
  };
  walk(node);
  return texts;
};

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnMount: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <GetPaidScreen />
    </QueryClientProvider>,
  );
};

describe('GetPaidScreen (Frame F2b)', () => {
  beforeEach(() => {
    mockGoBack.mockReset();
    mockRefreshProfile.mockReset();
    (openStripeConnectOnboarding as jest.Mock).mockReset();
    fetchStripeConnectStatus.mockReset();
  });

  it('shows F2b not-connected copy and continues to Stripe', async () => {
    fetchStripeConnectStatus.mockResolvedValue({
      connected: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    });

    const view = renderScreen();
    const continueCta = await screen.findByLabelText(GET_PAID_COPY.continueCta);
    expect(continueCta).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.continueCta)).toBeTruthy();
    // F2b lock: sticky Continue under status, then helper, then Not now.
    expect(screen.getByTestId('get-paid-actions')).toBeTruthy();
    expect(screen.getByTestId('get-paid-scroll')).toBeTruthy();
    expect(ancestorTestIds(continueCta)).toContain('get-paid-actions');
    expect(ancestorTestIds(continueCta)).not.toContain('get-paid-scroll');
    expect(screen.getByText(GET_PAID_COPY.screenSubtitle)).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.feeCopy)).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.notConnectedTitle)).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.notConnectedBody)).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.leaveAppHelper)).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.notNowCta)).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.footer)).toBeTruthy();

    const texts = collectText(view.root);
    const statusAt = texts.indexOf(GET_PAID_COPY.notConnectedTitle);
    const continueAt = texts.indexOf(GET_PAID_COPY.continueCta);
    const helperAt = texts.indexOf(GET_PAID_COPY.leaveAppHelper);
    const notNowAt = texts.indexOf(GET_PAID_COPY.notNowCta);
    expect(statusAt).toBeGreaterThan(-1);
    expect(continueAt).toBeGreaterThan(statusAt);
    expect(helperAt).toBeGreaterThan(continueAt);
    expect(notNowAt).toBeGreaterThan(helperAt);

    fireEvent.press(await screen.findByLabelText(GET_PAID_COPY.continueCta));
    await waitFor(() => {
      expect(openStripeConnectOnboarding).toHaveBeenCalledTimes(1);
    });
  });

  it('does not re-onboard when status is Ready', async () => {
    fetchStripeConnectStatus.mockResolvedValue({
      connected: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      onboardingComplete: true,
    });

    renderScreen();

    expect(await screen.findByText(GET_PAID_COPY.refreshCta)).toBeTruthy();
    expect(screen.queryByText(GET_PAID_COPY.continueCta)).toBeNull();

    fireEvent.press(screen.getByLabelText(GET_PAID_COPY.refreshCta));
    expect(openStripeConnectOnboarding).not.toHaveBeenCalled();
  });

  it('closes on Not now', async () => {
    fetchStripeConnectStatus.mockResolvedValue({
      connected: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    });

    renderScreen();
    fireEvent.press(await screen.findByText(GET_PAID_COPY.notNowCta));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('treats missing status as not-connected and still shows Continue to Stripe', async () => {
    fetchStripeConnectStatus.mockResolvedValue(null);

    renderScreen();

    expect(await screen.findByLabelText(GET_PAID_COPY.continueCta)).toBeTruthy();
    expect(await screen.findByText(GET_PAID_COPY.notConnectedTitle)).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.leaveAppHelper)).toBeTruthy();

    fireEvent.press(screen.getByLabelText(GET_PAID_COPY.continueCta));
    await waitFor(() => {
      expect(openStripeConnectOnboarding).toHaveBeenCalledTimes(1);
    });
  });

  it('pins Continue in a sticky action bar for not-connected', async () => {
    fetchStripeConnectStatus.mockResolvedValue({
      connected: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    });

    renderScreen();

    // accessibilityLabel stays Continue to Stripe (not Ready → Refresh).
    const continueCta = await screen.findByLabelText('Continue to Stripe');
    expect(continueCta).toBeTruthy();
    expect(ancestorTestIds(continueCta)).toContain('get-paid-actions');
    expect(ancestorTestIds(continueCta)).not.toContain('get-paid-scroll');
    expect(screen.getByText(GET_PAID_COPY.notConnectedTitle)).toBeTruthy();
    expect(screen.getByTestId('get-paid-scroll')).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.leaveAppHelper)).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.notNowCta)).toBeTruthy();
  });

  it('keeps Continue to Stripe when status fetch errors', async () => {
    const authError = Object.assign(new Error('Request failed'), {
      isAxiosError: true,
      response: { status: 401, data: { detail: 'Authentication credentials were not provided.' } },
    });
    fetchStripeConnectStatus.mockRejectedValue(authError);

    renderScreen();

    expect(await screen.findByLabelText(GET_PAID_COPY.continueCta)).toBeTruthy();
    expect(await screen.findByText(GET_PAID_COPY.notConnectedTitle)).toBeTruthy();
  });
});
