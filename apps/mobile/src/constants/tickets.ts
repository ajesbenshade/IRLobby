export const PLATFORM_FEE_PERCENT = 10;

export const PROTOTYPE_FOOTER_HOST = 'Stripe Connect Prototype — no charge';

export const PROTOTYPE_FOOTER_BUYER =
  'Host payout via Stripe Connect · 10% IRLobby commission · Not an App Store IAP.';

/** HTTPS bounce pages Stripe Account Links accept. Avoid sending bare irlobby://. */
export const STRIPE_CONNECT_HTTPS_RETURN_URL = 'https://api.irlobby.com/stripe/connect/return';
export const STRIPE_CONNECT_HTTPS_REFRESH_URL = 'https://api.irlobby.com/stripe/connect/refresh';

export const GET_PAID_COPY = {
  rowTitle: 'Get paid',
  rowSubtitle: 'Connect Stripe to receive ticket payouts',
  screenTitle: 'Get paid',
  screenSubtitle: 'Connect a payout account to sell tickets.',
  feeCopy: `IRLobby takes ${PLATFORM_FEE_PERCENT}% + Stripe fees.`,
  continueCta: 'Continue to Stripe',
  notNowCta: 'Not now',
  doneCta: 'Done',
  refreshCta: 'Refresh status',
  footer: 'Stripe Connect · Express · Test mode — no live charges',
  notConnectedTitle: 'Not connected',
  notConnectedBody: "You're not connected to a payout account yet.\nConnect to start selling tickets.",
  pendingTitle: 'Pending',
  pendingBody: 'Stripe still needs a few details before you can receive ticket payouts.',
  readyTitle: 'Connected',
  readyBody: `Your payout account is connected. Ticketed events send ${100 - PLATFORM_FEE_PERCENT}% to you.`,
  unavailableBody: 'Payouts aren’t live on this server yet. You can still host free plans.',
} as const;

export const STRIPE_CONNECT_CHIP = {
  notConnected: 'Not connected',
  pending: 'Pending',
  ready: 'Ready',
} as const;

export function parseTicketPrice(value: string | number | null | undefined): number {
  const amount = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function hostPayoutPerTicket(price: number): number {
  return Math.round(price * (1 - PLATFORM_FEE_PERCENT / 100) * 100) / 100;
}

export function platformFeeAmount(price: number, quantity = 1): number {
  return Math.round(price * (PLATFORM_FEE_PERCENT / 100) * quantity * 100) / 100;
}

export function orderSubtotal(price: number, quantity = 1): number {
  return Math.round(price * quantity * 100) / 100;
}

export function orderTotal(price: number, quantity = 1): number {
  return Math.round((orderSubtotal(price, quantity) + platformFeeAmount(price, quantity)) * 100) / 100;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function hostFeePreviewCopy(price: number): string {
  return `IRLobby takes ${PLATFORM_FEE_PERCENT}% + Stripe fees — you get ~${formatUsd(hostPayoutPerTicket(price))}/ticket`;
}

export function makeTicketId(seed?: string): string {
  if (seed) {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }
    return `IR-${hash.toString(16).toUpperCase().padStart(6, '0').slice(-6)}`;
  }

  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .toUpperCase()
    .padStart(6, '0');
  return `IR-${hex}`;
}

export function formatEventDateLabel(value?: string): string {
  if (!value?.trim()) {
    return 'Date TBD';
  }

  const parsed = new Date(value.includes('T') || value.includes(' ') ? value.replace(' ', 'T') : value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatEventTimeLabel(value?: string): string {
  if (!value?.trim()) {
    return 'Time TBD';
  }

  const parsed = new Date(value.includes('T') || value.includes(' ') ? value.replace(' ', 'T') : value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatEventWhenLabel(value?: string): string {
  if (!value?.trim()) {
    return 'Time TBD';
  }

  const parsed = new Date(value.includes('T') || value.includes(' ') ? value.replace(' ', 'T') : value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const weekday = parsed.toLocaleDateString(undefined, { weekday: 'short' });
  const rest = parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${weekday} ${rest} · ${time}`;
}
