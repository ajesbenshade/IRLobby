/**
 * Thin RevenueCat / Apple IAP client for the vNext stub.
 *
 * Safe defaults: no live key, no charges. Init no-ops when the public iOS
 * SDK key is missing. Purchase / restore / live offerings throw a clear
 * error until sandbox + App Store Connect products are wired.
 */

import { IAP_CATALOG, type IapProductId } from '@constants/iap';
import { config } from '@constants/config';

export const IAP_NOT_CONFIGURED_MESSAGE =
  'RevenueCat is not configured. Set EXPO_PUBLIC_REVENUECAT_IOS_API_KEY and use an iOS sandbox build. No live charges in this stub.';

export const IAP_SANDBOX_NOT_CONFIGURED_MESSAGE =
  'Apple IAP sandbox is not configured. Create the locked SKUs in App Store Connect, attach them to a RevenueCat offering, then retry on a StoreKit sandbox build.';

export class IapNotConfiguredError extends Error {
  constructor(message = IAP_NOT_CONFIGURED_MESSAGE) {
    super(message);
    this.name = 'IapNotConfiguredError';
  }
}

export class IapSandboxNotConfiguredError extends Error {
  constructor(message = IAP_SANDBOX_NOT_CONFIGURED_MESSAGE) {
    super(message);
    this.name = 'IapSandboxNotConfiguredError';
  }
}

export type StubOfferingPackage = {
  identifier: IapProductId;
  productId: IapProductId;
  title: string;
  displayPrice: string;
  source: 'stub';
};

export type PurchasesInitResult = {
  configured: boolean;
  reason?: 'missing_api_key' | 'sdk_unavailable' | 'already_configured';
};

type PurchasesPackageLike = {
  identifier: string;
  product: {
    identifier: string;
  };
};

type PurchasesSdk = {
  configure: (options: { apiKey: string }) => void | Promise<void>;
  getOfferings: () => Promise<{
    current: { availablePackages: PurchasesPackageLike[] } | null;
  }>;
  purchasePackage: (pkg: PurchasesPackageLike) => Promise<unknown>;
  restorePurchases: () => Promise<unknown>;
};

let configured = false;
let configureAttempted = false;

const readApiKey = () => config.revenueCatIosApiKey?.trim() ?? '';

export const isPurchasesConfigured = () => configured;

export const getStubOfferings = (): StubOfferingPackage[] =>
  (Object.keys(IAP_CATALOG) as IapProductId[]).map((productId) => {
    const product = IAP_CATALOG[productId];
    return {
      identifier: product.productId,
      productId: product.productId,
      title: product.title,
      displayPrice: product.displayPrice,
      source: 'stub' as const,
    };
  });

function loadPurchases(): PurchasesSdk | null {
  try {
    // Lazy require so Jest / web / Expo Go still boot when the native module
    // is missing. Billing is a no-op until a sandbox key + native build exist.
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    const mod = require('react-native-purchases') as PurchasesSdk & {
      default?: PurchasesSdk;
    };
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

function assertConfigured(): PurchasesSdk {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new IapNotConfiguredError();
  }

  const purchases = loadPurchases();
  if (!purchases?.configure || !purchases.getOfferings) {
    throw new IapSandboxNotConfiguredError(
      'react-native-purchases is installed but the native module is unavailable. Use an iOS dev/sandbox build — Expo Go cannot complete Apple IAP.',
    );
  }

  return purchases;
}

export async function initPurchases(): Promise<PurchasesInitResult> {
  if (configured) {
    return { configured: true, reason: 'already_configured' };
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    if (!configureAttempted) {
      console.info('[purchases] EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is empty. IAP stub stays offline.');
    }
    configureAttempted = true;
    return { configured: false, reason: 'missing_api_key' };
  }

  const purchases = loadPurchases();
  if (!purchases?.configure) {
    configureAttempted = true;
    console.warn('[purchases] RevenueCat SDK unavailable. Sandbox native build required.');
    return { configured: false, reason: 'sdk_unavailable' };
  }

  try {
    await purchases.configure({ apiKey });
    configured = true;
    return { configured: true };
  } catch (error) {
    configureAttempted = true;
    const message = error instanceof Error ? error.message : 'Unknown configure error';
    throw new IapSandboxNotConfiguredError(
      `RevenueCat configure failed: ${message}. ${IAP_SANDBOX_NOT_CONFIGURED_MESSAGE}`,
    );
  }
}

export async function getOfferings(): Promise<StubOfferingPackage[]> {
  const purchases = assertConfigured();
  if (!configured) {
    await initPurchases();
  }

  let current: { availablePackages: PurchasesPackageLike[] } | null;
  try {
    current = (await purchases.getOfferings()).current;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown offerings error';
    throw new IapSandboxNotConfiguredError(
      `Unable to load RevenueCat offerings: ${message}. ${IAP_SANDBOX_NOT_CONFIGURED_MESSAGE}`,
    );
  }

  const packages = current?.availablePackages ?? [];
  const mapped = packages
    .map((pkg) => {
      const productId = pkg.product?.identifier as IapProductId | undefined;
      if (!productId || !(productId in IAP_CATALOG)) {
        return null;
      }
      const catalog = IAP_CATALOG[productId];
      return {
        identifier: productId,
        productId,
        title: catalog.title,
        displayPrice: catalog.displayPrice,
        source: 'stub' as const,
      };
    })
    .filter((value): value is StubOfferingPackage => value != null);

  if (mapped.length === 0) {
    throw new IapSandboxNotConfiguredError(
      'RevenueCat returned no locked IRLobby SKUs (plus_monthly, plus_yearly, boost_pack).',
    );
  }

  return mapped;
}

export async function purchasePackage(productId: IapProductId): Promise<unknown> {
  const purchases = assertConfigured();
  if (!configured) {
    await initPurchases();
  }

  let current: { availablePackages: PurchasesPackageLike[] } | null;
  try {
    current = (await purchases.getOfferings()).current;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown offerings error';
    throw new IapSandboxNotConfiguredError(
      `Unable to start purchase for ${productId}: ${message}. ${IAP_SANDBOX_NOT_CONFIGURED_MESSAGE}`,
    );
  }

  const pkg = current?.availablePackages.find(
    (item) => item.product?.identifier === productId || item.identifier === productId,
  );
  if (!pkg) {
    throw new IapSandboxNotConfiguredError(
      `Package ${productId} is not in the current RevenueCat offering. ${IAP_SANDBOX_NOT_CONFIGURED_MESSAGE}`,
    );
  }

  return purchases.purchasePackage(pkg);
}

export async function restorePurchases(): Promise<unknown> {
  const purchases = assertConfigured();
  if (!configured) {
    await initPurchases();
  }

  try {
    return await purchases.restorePurchases();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown restore error';
    throw new IapSandboxNotConfiguredError(
      `Restore failed: ${message}. ${IAP_SANDBOX_NOT_CONFIGURED_MESSAGE}`,
    );
  }
}

export function __resetPurchasesClientForTests() {
  configured = false;
  configureAttempted = false;
}
