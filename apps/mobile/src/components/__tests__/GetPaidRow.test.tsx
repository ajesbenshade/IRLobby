import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { GetPaidRow } from '@components/GetPaidRow';
import { GET_PAID_COPY, STRIPE_CONNECT_CHIP } from '@constants/tickets';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: { canSellTickets: false },
  }),
}));

jest.mock('@services/paymentService', () => {
  const actual = jest.requireActual('@services/paymentService');
  return {
    ...actual,
    fetchStripeConnectStatus: jest.fn().mockResolvedValue({
      available: true,
      connected: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      onboardingComplete: false,
    }),
  };
});

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

const renderRow = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 60_000, staleTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(['stripe-connect-status'], {
    available: true,
    connected: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    onboardingComplete: false,
  });
  return render(
    <QueryClientProvider client={client}>
      <GetPaidRow />
    </QueryClientProvider>,
  );
};

describe('GetPaidRow (Frame F)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('shows the Get paid row and opens the onboard screen', () => {
    renderRow();

    expect(screen.getByText(GET_PAID_COPY.rowTitle)).toBeTruthy();
    expect(screen.getByText(GET_PAID_COPY.rowSubtitle)).toBeTruthy();
    expect(screen.getByText(STRIPE_CONNECT_CHIP.notConnected)).toBeTruthy();

    fireEvent.press(screen.getByLabelText(GET_PAID_COPY.rowTitle));
    expect(mockNavigate).toHaveBeenCalledWith('GetPaid');
  });
});
