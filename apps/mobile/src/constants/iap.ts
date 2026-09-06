/**
 * Locked Apple IAP SKUs for the vNext prototype.
 *
 * These IDs are the contract for a future RevenueCat + App Store Connect
 * catalog. They are not live products and must not be charged.
 */

export const IAP_PRODUCT_IDS = {
  plusMonthly: 'plus_monthly',
  plusYearly: 'plus_yearly',
  boostPack: 'boost_pack',
} as const;

export type IapProductId = (typeof IAP_PRODUCT_IDS)[keyof typeof IAP_PRODUCT_IDS];

export type IapProductType = 'subscription' | 'consumable';

export type PaywallFrame = 'swipeCap' | 'plusValue' | 'boostNudge';

export type IapCatalogProduct = {
  productId: IapProductId;
  type: IapProductType;
  entitlement: 'plus' | 'boost';
  displayPrice: string;
  priceUsd: number;
  periodLabel: string;
  title: string;
  subtitle: string;
};

export const IAP_CATALOG: Record<IapProductId, IapCatalogProduct> = {
  plus_monthly: {
    productId: 'plus_monthly',
    type: 'subscription',
    entitlement: 'plus',
    displayPrice: '$4.99/mo',
    priceUsd: 4.99,
    periodLabel: 'Monthly',
    title: 'IRLobby Plus',
    subtitle: 'Keep the deck moving past the free swipe cap.',
  },
  plus_yearly: {
    productId: 'plus_yearly',
    type: 'subscription',
    entitlement: 'plus',
    displayPrice: '$39.99/yr',
    priceUsd: 39.99,
    periodLabel: 'Yearly',
    title: 'IRLobby Plus',
    subtitle: 'A full year of Plus for less than two months of monthly.',
  },
  boost_pack: {
    productId: 'boost_pack',
    type: 'consumable',
    entitlement: 'boost',
    displayPrice: '$2.99',
    priceUsd: 2.99,
    periodLabel: 'One-time',
    title: 'Boost pack',
    subtitle: 'A one-time bump when a night is quiet.',
  },
};

export const PAYWALL_FRAMES: Record<
  PaywallFrame,
  {
    frame: PaywallFrame;
    eyebrow: string;
    title: string;
    subtitle: string;
    products: IapProductId[];
    primaryProductId: IapProductId;
  }
> = {
  swipeCap: {
    frame: 'swipeCap',
    eyebrow: 'Daily swipe cap',
    title: 'Keep swiping with Plus',
    subtitle: 'Free swipes are done for today. Plus unlocks more so the night does not stop here.',
    products: [IAP_PRODUCT_IDS.plusMonthly],
    primaryProductId: IAP_PRODUCT_IDS.plusMonthly,
  },
  plusValue: {
    frame: 'plusValue',
    eyebrow: 'IRLobby Plus',
    title: 'Free vs Plus',
    subtitle: 'Same real plans. Plus just keeps you in the deck longer.',
    products: [IAP_PRODUCT_IDS.plusMonthly, IAP_PRODUCT_IDS.plusYearly],
    primaryProductId: IAP_PRODUCT_IDS.plusYearly,
  },
  boostNudge: {
    frame: 'boostNudge',
    eyebrow: 'Quiet night',
    title: 'Give tonight a boost',
    subtitle: 'When the feed is thin, a boost pack can surface your plan without a Plus subscription.',
    products: [IAP_PRODUCT_IDS.boostPack],
    primaryProductId: IAP_PRODUCT_IDS.boostPack,
  },
};

export const PLUS_VALUE_ROWS = [
  { label: 'Daily swipe cap', free: 'Limited', plus: 'More swipes' },
  { label: 'Discover feed', free: 'Organic', plus: 'Priority placement' },
  { label: 'Quiet-night boost', free: 'Not included', plus: 'Discounted packs' },
  { label: 'Ticketed events', free: 'Stripe checkout', plus: 'Stripe checkout' },
] as const;

export const isPaywallFrame = (value: unknown): value is PaywallFrame =>
  value === 'swipeCap' || value === 'plusValue' || value === 'boostNudge';
