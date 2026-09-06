# IRLobby vNext Apple IAP stub

Prototype scaffolding only. This does **not** enable live charges, create App Store Connect products, or change the 1.0 Waiting-for-Review binary path.

Digital Plus / boosts use Apple IAP via RevenueCat later. Real-world tickets stay on **Stripe Connect** (`src/services/paymentService.ts`) and must not be moved to IAP.

## Locked SKUs

| Product ID | Type | Prototype price | Entitlement |
|---|---|---|---|
| `plus_monthly` | auto-renewable subscription | $4.99/mo | `plus` |
| `plus_yearly` | auto-renewable subscription | $39.99/yr | `plus` |
| `boost_pack` | consumable | $2.99 | `boost` |

Source of truth in the app: `src/constants/iap.ts`.

## Paywall frames

| Frame | Route | Trigger | Product focus |
|---|---|---|---|
| `swipeCap` | `Paywall` `{ frame: 'swipeCap' }` | Discover daily swipe cap | `plus_monthly` |
| `plusValue` | `Paywall` `{ frame: 'plusValue' }` | Profile → Free vs Plus | `$4.99` / `$39.99` |
| `boostNudge` | `Paywall` `{ frame: 'boostNudge' }` | Discover quiet-night empty state | `boost_pack` |

Deep link (after auth): `irlobby://paywall/swipeCap` (also `plusValue`, `boostNudge`).

## Client stub

`src/services/purchasesClient.ts` exposes:

- `initPurchases()` — no-op when `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` is empty
- `getOfferings()`
- `purchasePackage(productId)`
- `restorePurchases()`

Missing key or missing native sandbox throws `IapNotConfiguredError` / `IapSandboxNotConfiguredError`. The UI still renders locked SKU copy from the local catalog.

## Env (safe placeholder)

```dotenv
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
```

Use the **public** iOS SDK key (`appl_...`) later. Never commit a secret RevenueCat API key. Do not add this to production EAS env until Design/Backend sign off.

## Later: RevenueCat + App Store Connect

Do this on a **new** iOS build, not the 1.0 review binary.

1. App Store Connect → create the three product IDs above. Do not submit them with the current 1.0 review.
2. RevenueCat → iOS app `com.irlobby.app` → attach those store products.
3. Entitlements: `plus` (monthly + yearly), `boost` (consumable).
4. Current offering packages must use the same product IDs.
5. Put the public iOS SDK key in a **local / preview** EAS env as `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`.
6. Build an iOS dev client (`eas.json` `development` or `preview`). Expo Go cannot complete StoreKit purchases.
7. Sandbox testers only. Confirm no production deploy and no live charges.

`react-native-purchases` is already a dependency for Expo SDK 54. A later native rebuild is required after the key exists.

## Out of scope (do not do here)

- Live Stripe digital IAP
- Changes to Stripe Connect ticket checkout
- App Store submit workflow / EAS production submit
- Production env values or secrets
