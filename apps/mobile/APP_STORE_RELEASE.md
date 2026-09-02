# iOS App Store Release Checklist (IRLobby Mobile)

Use this checklist to publish `apps/mobile` with your Apple Developer account.

Mobile is the App Store release target. The web client in `apps/web` remains a supported deployment for `irlobby.com` (prebuilt `dist` via cPanel).

## 1) Accounts and tools

- Active Apple Developer Program membership
- Access to App Store Connect for your team
- `eas-cli` installed and logged in (`npx eas login`)
- One-time EAS credential setup completed so production iOS builds can run without interactive Apple login

## 1.1) Enable automatic Expo builds from GitHub

This repository can trigger a new iOS production build automatically on every push to `main` when mobile files change.

Required one-time setup:

1. Create an Expo access token from your Expo account.
2. Add it to GitHub repository secrets as `EXPO_TOKEN`.
3. Run one successful `eas build -p ios --profile production` manually on a trusted machine. Complete any Apple credential prompts so EAS stores the required iOS build credentials remotely.
4. Run one successful `eas submit -p ios --profile production` manually on a trusted machine, or configure an App Store Connect API key in Expo, so non-interactive submissions can complete from CI.

Notes:

- Automatic builds use `.github/workflows/mobile-eas-build.yml`.
- The workflow triggers `eas build --platform ios --profile production --auto-submit --non-interactive --no-wait`.
- If EAS still needs missing Apple build or App Store Connect submit credentials, the GitHub workflow fails until the one-time manual setup is finished.

## 2) Configure production environment values

Create a local `.env` for builds (or use EAS secrets) with production endpoints:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://api.irlobby.com
EXPO_PUBLIC_WEBSOCKET_URL=wss://api.irlobby.com
EXPO_PUBLIC_TWITTER_CLIENT_ID=...
EXPO_PUBLIC_TWITTER_REDIRECT_URI=irlobby://auth/twitter
EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN=...
# Google Sign-In (required for Continue with Google on store builds)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
# Optional Expo Go / legacy fallback (prefer platform-specific IDs above)
# EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=...
# EXPO_PUBLIC_GOOGLE_CLIENT_ID=...
# Optional but recommended for production: enables Sentry crash + perf reporting.
EXPO_PUBLIC_SENTRY_DSN=...
```

Notes:

- `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_WEBSOCKET_URL` must point to your live backend.
- Backend must support HTTPS/WSS and include required CORS/host settings.
- Prefer GitHub Actions variables / EAS secrets over committing real client IDs.

### Social login credential checklist

| Credential | Status | Where |
|------------|--------|-------|
| Backend `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` | Present (GitHub secrets + live API) | Server `.env.production` |
| `EXPO_PUBLIC_TWITTER_CLIENT_ID` | Present (GitHub variable) | Mobile EAS / CI |
| `EXPO_PUBLIC_TWITTER_REDIRECT_URI` | Present → `irlobby://auth/twitter` | Mobile EAS / CI |
| Twitter portal callback | Must include `https://api.irlobby.com/api/auth/twitter/callback/` | X Developer Portal |
| `APPLE_OAUTH_AUDIENCES` | Set → `com.irlobby.app` (live route accepts Apple posts) | Backend `.env.production` |
| Apple Sign In capability | Enable on App ID `com.irlobby.app` | Apple Developer |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | **Missing — create in Google Cloud** | GitHub var + EAS |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | **Missing — create in Google Cloud** | GitHub var + EAS |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | **Missing — create in Google Cloud** | GitHub var + EAS |
| Backend `GOOGLE_OAUTH_CLIENT_IDS` | **Missing — comma-separated list of all Google client IDs** | Server `.env.production` |

Google Cloud Console setup (bundle/package `com.irlobby.app`):

1. Create an **iOS** OAuth client (bundle ID `com.irlobby.app`).
2. Create an **Android** OAuth client (package `com.irlobby.app` + SHA-1 from `eas credentials`).
3. Create a **Web** OAuth client (used as `webClientId` for ID token audience).
4. Put all three IDs into backend `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated) and the matching `EXPO_PUBLIC_GOOGLE_*` vars.

### Production verification (2026-07-09)

| Check | Result |
|-------|--------|
| `GET /api/health/` | OK |
| `GET /api/auth/twitter/status/` | `configured: true` |
| Mobile Twitter `auth_url` callback | `https://api.irlobby.com/api/auth/twitter/callback/` |
| `POST /api/auth/google/mobile/` | Live (JSON; returns 503 until `GOOGLE_OAUTH_CLIENT_IDS` is set) |
| `POST /api/auth/apple/mobile/` | Live (JSON 400 on invalid token; audience `com.irlobby.app`) |
| Device smoke tests | Build a production/preview EAS binary (not Expo Go). X can be tested now; Google needs client IDs first; Apple needs a real iOS device/TestFlight. |

### Expo dashboard builds (`Build from GitHub`)

See [`EAS_ENV_SETUP.md`](EAS_ENV_SETUP.md). Summary:

1. **Base directory:** `apps/mobile`
2. Add **Production** environment variables in Expo (Google iOS/Android/Web IDs, Twitter client ID, Mapbox token).
3. **Uncheck EAS Submit** unless Play/App Store submit credentials are configured in Expo.
4. Use build profile **`production`**.

## 2.1) Configure Twitter/X login for standalone iOS builds

The mobile app uses a backend-owned Twitter OAuth flow. For standalone/TestFlight builds, the app deep link must remain `irlobby://auth/twitter`.

Required setup:

1. Set backend env vars `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`.
2. Register the backend callback URL in the Twitter/X developer portal:
	- Local example: `http://localhost:8000/api/auth/twitter/callback/`
	- Production (required): `https://api.irlobby.com/api/auth/twitter/callback/`
3. Set `EXPO_PUBLIC_TWITTER_REDIRECT_URI=irlobby://auth/twitter` for the mobile app if you want an explicit runtime value.

Notes:

- The backend callback exchanges the Twitter authorization code and then redirects back into the app with app JWTs.
- This flow is for standalone/TestFlight builds. Expo Go callback URLs are not part of the supported release path.

## 2.2) Configure Google and Apple for store builds

1. Backend: set `GOOGLE_OAUTH_CLIENT_IDS` and `APPLE_OAUTH_AUDIENCES=com.irlobby.app`, then redeploy so `/api/auth/google/mobile/` and `/api/auth/apple/mobile/` exist.
2. Mobile: bake Google client IDs into the production EAS profile (GitHub variables → CI env → `eas build`).
3. Apple: enable Sign In with Apple on App ID `com.irlobby.app` (app already sets `usesAppleSignIn: true`).

## 3) Confirm app identity

Current bundle identifier is set in `app.config.ts`:

- iOS: `com.irlobby.app`

Confirm that this matches the App ID in Apple Developer and App Store Connect.

## 4) Build production iOS binary

From `apps/mobile`:

```bash
npm install
npm run build:ios
```

This runs `eas build -p ios --profile production`.

For automated builds, pushes to `main` that touch `apps/mobile/**` or the root `package-lock.json` submit the same production build through GitHub Actions.

## 5) Submit to App Store Connect

```bash
npm run submit:ios
```

This runs `eas submit -p ios --profile production`.

If you use GitHub Actions, the same submit step runs automatically after a successful production iOS build because the workflow uses EAS auto-submit.

## 6) App Store Connect metadata

Complete before you submit for review:

- App name, subtitle, description, keywords
- Privacy policy URL
- Support URL and marketing URL (if available)
- Screenshots for required iPhone sizes
- App privacy questionnaire answers

Copy-ready metadata lives in [`store/metadata/`](./store/metadata/).

Privacy questionnaire reference: [`store/metadata/privacy-questionnaire.md`](./store/metadata/privacy-questionnaire.md).

Reviewer demo account (App Privacy → Sign-In Information): [`store/metadata/reviewer-demo-account.md`](./store/metadata/reviewer-demo-account.md).

Privacy Policy and Support pages are committed at `site/privacy.html` and `site/support.html`. The Hetzner nginx/Docker stack serves them at `/privacy` and `/support` so `https://irlobby.com/privacy` and `https://irlobby.com/support` work after the apex DNS A records point at that host and TLS is issued. See [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md). Do not rely on the leftover Namecheap shared-hosting site.

Screenshot capture guide: [`store/screenshots/README.md`](./store/screenshots/README.md).

### Pre-submission sanity check

Run before every release build:

```bash
cd apps/mobile
npm run presubmit
```

This validates the icon, runs typecheck and tests, scans for debug logs, and verifies metadata length limits.

It also checks the required reviewer/privacy support files and the five required App Store screenshot filenames in `store/screenshots/`.

## 7) Backend production requirements

Confirm that backend env/config is production-ready:

- `DEBUG=False`
- Valid `ALLOWED_HOSTS`
- Correct `CORS_ALLOWED_ORIGINS`
- Production database configured
- HTTPS enabled (required for reliable mobile networking)

## 8) Review-critical checks

- Permission prompts are justified and accurate (camera/location/photos)
- Sign in and registration flows work against production backend
- Password reset links open correct frontend/app route
- App handles API downtime with errors and retries

## 9) TestFlight first, then App Review

Recommended flow:

1. Upload build
2. Add internal testers
3. Validate onboarding/auth/activity flows
4. Submit to external testers (optional)
5. Submit for App Review

## 10) Launch weeks (ops checklist)

### Week 3 — first session + supply

Engineering (mobile):

- [x] Onboarding: location → vibe → notifications (photo deferred to Profile)
- [x] Apple Sign-In first in the login OAuth stack
- [x] Discover defaults to Tonight (next ~8 hours); price filters hidden for v1
- [x] Recruiting empty states on Discover, Matches, Chat, Activity, Profile

Ops (before submit):

- [ ] Seed 5–10 real activities in your launch city for the next few evenings
- [ ] Create 2–3 demo accounts for App Review / TestFlight
- [ ] Smoke TestFlight auth matrix (Apple / Google / Twitter / email)
- [ ] Confirm empty Discover with Tonight on still explains how to widen / host
