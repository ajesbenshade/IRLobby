import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { api } from './apiClient';
import {
  GET_PAID_COPY,
  STRIPE_CONNECT_CHIP,
  STRIPE_CONNECT_HTTPS_REFRESH_URL,
  STRIPE_CONNECT_HTTPS_RETURN_URL,
} from '@constants/tickets';
import { API_ROUTE_BUILDERS, API_ROUTES } from '@shared/schema';
import { isAllowedStripeUrl } from '@utils/safeUrl';

export interface StripeConnectStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  accountId?: string | null;
  onboardingComplete: boolean;
  available?: boolean;
  status?: string | null;
}

export type StripeConnectChipLabel =
  (typeof STRIPE_CONNECT_CHIP)[keyof typeof STRIPE_CONNECT_CHIP];

export interface TicketPurchaseResponse {
  session_id: string;
  sessionId?: string;
  url?: string | null;
  checkoutUrl?: string | null;
  platformFeePercent?: number;
  platformFeeAmountCents?: number;
}

const CHIP_ALIASES: Record<string, StripeConnectChipLabel> = {
  'not connected': STRIPE_CONNECT_CHIP.notConnected,
  not_connected: STRIPE_CONNECT_CHIP.notConnected,
  pending: STRIPE_CONNECT_CHIP.pending,
  ready: STRIPE_CONNECT_CHIP.ready,
};

export function stripeConnectChipLabel(
  status?: StripeConnectStatus | null,
  canSellTickets = false,
): StripeConnectChipLabel {
  const wording = status?.status?.trim().toLowerCase();
  if (wording && CHIP_ALIASES[wording]) {
    return CHIP_ALIASES[wording];
  }

  if (canSellTickets || status?.payoutsEnabled || status?.onboardingComplete) {
    return STRIPE_CONNECT_CHIP.ready;
  }

  if (status?.connected || status?.detailsSubmitted) {
    return STRIPE_CONNECT_CHIP.pending;
  }

  return STRIPE_CONNECT_CHIP.notConnected;
}

export function stripeConnectStatusCopy(chip: StripeConnectChipLabel) {
  if (chip === STRIPE_CONNECT_CHIP.ready) {
    return { title: GET_PAID_COPY.readyTitle, body: GET_PAID_COPY.readyBody };
  }
  if (chip === STRIPE_CONNECT_CHIP.pending) {
    return { title: GET_PAID_COPY.pendingTitle, body: GET_PAID_COPY.pendingBody };
  }
  return { title: GET_PAID_COPY.notConnectedTitle, body: GET_PAID_COPY.notConnectedBody };
}

export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus> {
  // Status errors must throw so Get paid can show HelperText and still keep
  // Continue to Stripe. Do not treat 404/501/503 as a successful "unavailable"
  // payload — the live Connect status endpoint uses 503 for StripeConnectError
  // (e.g. missing key), and 401/502 already throw. Hiding the CTA on those
  // codes was the TestFlight Get paid empty-button bug.
  const response = await api.get<StripeConnectStatus>(API_ROUTES.USER_STRIPE_CONNECT_STATUS);
  return {
    ...response.data,
    available: response.data?.available !== false,
  };
}

export async function startStripeConnectOnboarding(): Promise<string> {
  const response = await api.post<{ url: string }>(
    API_ROUTES.USER_STRIPE_CONNECT_ONBOARD,
    {
      returnUrl: STRIPE_CONNECT_HTTPS_RETURN_URL,
      refreshUrl: STRIPE_CONNECT_HTTPS_REFRESH_URL,
    }
  );
  const url = response.data?.url;
  if (!url || !isAllowedStripeUrl(url)) {
    throw new Error('Stripe did not return a trusted onboarding link.');
  }
  return url;
}

export async function openStripeConnectOnboarding(): Promise<void> {
  const url = await startStripeConnectOnboarding();
  // Must use system browser — Stripe-hosted onboarding is not supported in WebViews.
  await WebBrowser.openBrowserAsync(url);
}

export async function purchaseActivityTicket(
  activityId: number | string
): Promise<TicketPurchaseResponse> {
  const successUrl = Linking.createURL('tickets/success');
  const cancelUrl = Linking.createURL('tickets/cancel');
  const response = await api.post<TicketPurchaseResponse>(
    API_ROUTE_BUILDERS.ticketPurchase(activityId),
    {
      successUrl: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl,
    }
  );
  return response.data;
}

export async function openTicketCheckout(
  activityId: number | string
): Promise<void> {
  const purchase = await purchaseActivityTicket(activityId);
  const checkoutUrl = purchase.url || purchase.checkoutUrl;
  if (!checkoutUrl || !isAllowedStripeUrl(checkoutUrl)) {
    throw new Error('Checkout URL was missing or not a trusted Stripe link.');
  }
  await WebBrowser.openBrowserAsync(checkoutUrl);
}
