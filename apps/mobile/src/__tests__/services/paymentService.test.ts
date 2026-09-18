import { API_ROUTES } from '@shared/schema';
import {
  GET_PAID_COPY,
  STRIPE_CONNECT_CHIP,
  STRIPE_CONNECT_HTTPS_REFRESH_URL,
  STRIPE_CONNECT_HTTPS_RETURN_URL,
} from '@constants/tickets';
import { api } from '@services/apiClient';
import {
  startStripeConnectOnboarding,
  stripeConnectChipLabel,
} from '@services/paymentService';

jest.mock('@services/apiClient', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `irlobby://${path}`),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: 'dismiss' }),
}));

const mockedApi = api as unknown as { post: jest.Mock };

describe('stripeConnectChipLabel', () => {
  it('maps API flags onto Not connected, Pending, and Ready', () => {
    expect(stripeConnectChipLabel({ connected: false, payoutsEnabled: false, detailsSubmitted: false, onboardingComplete: false })).toBe(
      STRIPE_CONNECT_CHIP.notConnected,
    );
    expect(stripeConnectChipLabel({ connected: true, payoutsEnabled: false, detailsSubmitted: true, onboardingComplete: false })).toBe(
      STRIPE_CONNECT_CHIP.pending,
    );
    expect(stripeConnectChipLabel({ connected: true, payoutsEnabled: true, detailsSubmitted: true, onboardingComplete: true })).toBe(
      STRIPE_CONNECT_CHIP.ready,
    );
    expect(stripeConnectChipLabel({ connected: false, payoutsEnabled: false, detailsSubmitted: false, onboardingComplete: false }, true)).toBe(
      STRIPE_CONNECT_CHIP.ready,
    );
  });

  it('prefers explicit API status wording when present', () => {
    expect(
      stripeConnectChipLabel({
        connected: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        onboardingComplete: false,
        status: 'Pending',
      }),
    ).toBe(STRIPE_CONNECT_CHIP.pending);
  });
});

describe('startStripeConnectOnboarding', () => {
  it('posts HTTPS api.irlobby.com return URLs instead of irlobby://', async () => {
    mockedApi.post.mockResolvedValue({
      data: { url: 'https://connect.stripe.com/setup/s/test' },
    });

    await startStripeConnectOnboarding();

    expect(mockedApi.post).toHaveBeenCalledWith(API_ROUTES.USER_STRIPE_CONNECT_ONBOARD, {
      returnUrl: STRIPE_CONNECT_HTTPS_RETURN_URL,
      refreshUrl: STRIPE_CONNECT_HTTPS_REFRESH_URL,
    });
    expect(STRIPE_CONNECT_HTTPS_RETURN_URL).toBe('https://api.irlobby.com/stripe/connect/return');
    expect(GET_PAID_COPY.footer).toContain('Test mode');
  });
});
