import axios from 'axios';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { api } from './apiClient';
import { API_ROUTE_BUILDERS, API_ROUTES } from '@shared/schema';
import { isAllowedStripeUrl } from '@utils/safeUrl';

export interface StripeConnectStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  accountId?: string | null;
  onboardingComplete: boolean;
  available?: boolean;
}

export interface TicketPurchaseResponse {
  session_id: string;
  sessionId?: string;
  url?: string | null;
  checkoutUrl?: string | null;
  platformFeePercent?: number;
  platformFeeAmountCents?: number;
}

const isStripeConnectUnavailable = (error: unknown) =>
  axios.isAxiosError(error) &&
  (error.response?.status === 404 ||
    error.response?.status === 501 ||
    error.response?.status === 503);

export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus> {
  try {
    const response = await api.get<StripeConnectStatus>(
      API_ROUTES.USER_STRIPE_CONNECT_STATUS
    );
    return { ...response.data, available: true };
  } catch (error) {
    if (isStripeConnectUnavailable(error)) {
      return {
        connected: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        onboardingComplete: false,
        available: false,
      };
    }
    throw error;
  }
}

export async function startStripeConnectOnboarding(): Promise<string> {
  const returnUrl = Linking.createURL('stripe/connect/return');
  const refreshUrl = Linking.createURL('stripe/connect/refresh');
  const response = await api.post<{ url: string }>(
    API_ROUTES.USER_STRIPE_CONNECT_ONBOARD,
    {
      returnUrl,
      refreshUrl,
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
