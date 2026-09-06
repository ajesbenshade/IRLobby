import {
  IAP_NOT_CONFIGURED_MESSAGE,
  IapNotConfiguredError,
  __resetPurchasesClientForTests,
  getStubOfferings,
  getOfferings,
  initPurchases,
  isPurchasesConfigured,
  purchasePackage,
  restorePurchases,
} from '@services/purchasesClient';

jest.mock('@constants/config', () => ({
  config: {
    revenueCatIosApiKey: '',
  },
}));

describe('purchasesClient stub', () => {
  beforeEach(() => {
    __resetPurchasesClientForTests();
  });

  it('init no-ops when the RevenueCat key is missing', async () => {
    const result = await initPurchases();
    expect(result).toEqual({ configured: false, reason: 'missing_api_key' });
    expect(isPurchasesConfigured()).toBe(false);
  });

  it('returns locked SKU stub offerings without calling billing', () => {
    const offerings = getStubOfferings();
    expect(offerings.map((item) => item.productId)).toEqual([
      'plus_monthly',
      'plus_yearly',
      'boost_pack',
    ]);
    expect(offerings.every((item) => item.source === 'stub')).toBe(true);
  });

  it('throws clearly for live offerings, purchase, and restore without a key', async () => {
    await expect(getOfferings()).rejects.toBeInstanceOf(IapNotConfiguredError);
    await expect(purchasePackage('plus_monthly')).rejects.toMatchObject({
      name: 'IapNotConfiguredError',
      message: IAP_NOT_CONFIGURED_MESSAGE,
    });
    await expect(restorePurchases()).rejects.toBeInstanceOf(IapNotConfiguredError);
  });
});
