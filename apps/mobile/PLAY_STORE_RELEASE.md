# Google Play Store Release Checklist (IRLobby Mobile)

Companion to [`APP_STORE_RELEASE.md`](./APP_STORE_RELEASE.md). Use this to publish `apps/mobile` to the Google Play Store.

## 1) Accounts and tools

- Google Play Console developer account (one-time $25 fee, identity verified)
- 2-step verification enabled on the Google account
- `eas-cli` installed and logged in (`npx eas login`)
- Play Console app entry created with package name `com.irlobby.app`

## 1.1) Google Play service account (required for CI submit)

EAS submits the AAB through a Google service account.

1. In Google Cloud Console (linked to the Play Console org), create a service account.
2. Grant it the `Service Account User` role.
3. In Play Console → Setup → API access, link the service account and grant **Release apps to testing tracks** + **Release apps to production**.
4. Create a JSON key for the service account and download it.
5. Add it to GitHub repository secrets as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (paste the entire JSON content).
6. Locally for manual submits, save it to `apps/mobile/credentials/play-service-account.json` (gitignored). Path is referenced from `eas.json`.

## 1.2) Enable automatic Expo builds from GitHub

Pushes to `main` that touch `apps/mobile/**` or the root `package-lock.json` trigger both `build-ios` and `build-android` jobs in [`.github/workflows/mobile-eas-build.yml`](../../.github/workflows/mobile-eas-build.yml).

The Android job runs:

```
eas build --platform android --profile production --auto-submit --non-interactive --no-wait
```

with the service account materialized from `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. The first manual `eas build -p android --profile production` on a trusted machine is still required so EAS can store the upload keystore (see step 3).

## 2) Production environment values

Same as iOS — see `APP_STORE_RELEASE.md` §2. The Android build inherits the `EXPO_PUBLIC_*` values from the `production` profile in `eas.json`.

## 3) App identity, signing, versioning

- Package: `com.irlobby.app` (`app.config.ts` → `android.package`)
- `versionCode` is managed remotely by EAS (`appVersionSource: "remote"` + `autoIncrement: true` in `eas.json`); do not hardcode.
- Enroll in **Play App Signing** when you upload the first AAB (Play Console will offer it).
- The first manual `eas build -p android --profile production` on a trusted machine generates and stores the upload keystore in EAS. Save the recovery codes.

## 4) 2026 platform requirements

- **`targetSdkVersion: 36` (Android 16)** — required for new app updates after **August 31, 2026**. Configured via `expo-build-properties` in `app.config.ts`.
- **App Bundle (AAB)** — `eas.json` sets `android.buildType: "app-bundle"` on the production profile.
- **16 KB page size** — Android 15+ devices require native libs to support 16 KB pages. RN 0.81 + Expo SDK 54 are compliant; verify any new native module updates do not regress.

## 5) Build production Android binary

From `apps/mobile`:

```bash
npm install
npx eas build --platform android --profile production
```

EAS produces an `.aab`. With `--auto-submit`, EAS forwards it to the configured Play track.

## 6) Play Console store listing

Reuse the text already drafted in `apps/mobile/store/metadata/`:

- **App name**: `app-name.txt`
- **Short description** (≤80 chars): use `subtitle.txt`
- **Full description** (≤4000 chars): `description.txt`
- **What's new** (≤500 chars): `release-notes.txt`
- **Promotional text** is iOS-only; not used on Play

Required graphics (Play-specific):

- App icon: 512×512 PNG (derive from `assets/icon.png`)
- Feature graphic: 1024×500 PNG (must be created — not yet present)
- Phone screenshots: at least 2, max 8, 16:9 or 9:16 between 320 and 3840 px
- 7-inch tablet screenshots (optional but recommended)
- Adaptive icon already configured at `assets/adaptive-icon.png`

## 7) Data safety form

IRLobby collects:

| Data type | Purpose | Shared? | Optional? |
|---|---|---|---|
| Email | Account, communications | No | No (account creation) |
| Name / display name | Account, profile | No | Yes (display name) |
| Photos | Profile, activities | No | Yes |
| Approximate + precise location | Activity discovery | No | Required while in use |
| In-app messages | App functionality (E2E within app) | No | No (when chat used) |
| Crash logs / diagnostics | Sentry — bug fixes | Sentry | Yes (can be disabled) |

Mark **data encrypted in transit** = Yes. Mark **users can request deletion** = Yes (link to in-app delete account flow).

## 8) Content rating

Run the Play Console IARC questionnaire. Match the iOS 17+ rating: expect **Teen** or **Mature 17+** because of user-to-user social and messaging features.

## 9) Release tracks

Recommended sequence:

1. **Internal testing** (`track: "internal"`, default in `eas.json`) — fast distribution to a small list of Google accounts.
2. **Closed testing (alpha)** — required for some new accounts (12 testers × 14 days).
3. **Open testing (beta)** — optional public beta.
4. **Production** — staged rollout (start at 10–20%).

To promote to production, change `submit.production.android.track` in `eas.json` from `"internal"` to `"production"` and switch `releaseStatus` to `"completed"` (or use the Play Console UI).

## 10) Pre-submission validation

```bash
cd apps/mobile
./scripts/pre-submit-check.sh   # icon, typecheck, debug logs, metadata lengths
npm run typecheck
npm test
```

## 11) Common rejection / hold reasons on Play

- Data safety form mismatch with actual SDK behavior (Sentry, Mapbox, etc.)
- Missing `targetSdkVersion: 36` after Aug 31, 2026
- Permissions declared in manifest but never used
- Privacy policy URL unreachable or doesn't mention the package name
- Account deletion flow not exposed in-app (required for accounts since 2024)

## 12) Reviewer demo account

Provide the same demo credentials documented in [`store/metadata/reviewer-demo-account.md`](./store/metadata/reviewer-demo-account.md) under Play Console → App content → App access.
