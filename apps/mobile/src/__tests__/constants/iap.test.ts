import {
  IAP_CATALOG,
  IAP_PRODUCT_IDS,
  PAYWALL_FRAMES,
  isPaywallFrame,
} from '@constants/iap';

describe('IAP catalog', () => {
  it('locks the three prototype SKUs and prices', () => {
    expect(IAP_PRODUCT_IDS).toEqual({
      plusMonthly: 'plus_monthly',
      plusYearly: 'plus_yearly',
      boostPack: 'boost_pack',
    });
    expect(IAP_CATALOG.plus_monthly.priceUsd).toBe(4.99);
    expect(IAP_CATALOG.plus_yearly.priceUsd).toBe(39.99);
    expect(IAP_CATALOG.boost_pack.priceUsd).toBe(2.99);
    expect(IAP_CATALOG.plus_monthly.type).toBe('subscription');
    expect(IAP_CATALOG.plus_yearly.type).toBe('subscription');
    expect(IAP_CATALOG.boost_pack.type).toBe('consumable');
  });

  it('maps paywall frames to the intended products', () => {
    expect(PAYWALL_FRAMES.swipeCap.primaryProductId).toBe('plus_monthly');
    expect(PAYWALL_FRAMES.plusValue.products).toEqual(['plus_monthly', 'plus_yearly']);
    expect(PAYWALL_FRAMES.boostNudge.primaryProductId).toBe('boost_pack');
    expect(isPaywallFrame('swipeCap')).toBe(true);
    expect(isPaywallFrame('unknown')).toBe(false);
  });
});
