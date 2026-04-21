# iOS App Store Release Checklist (IRLobby Mobile)

Use this checklist to publish `apps/mobile` with your Apple Developer account.

> `apps/web` is archived in this repository and is no longer a supported deployment target. Mobile is the only actively released client.

## 1) Accounts and tools

- Active Apple Developer Program membership
- Access to App Store Connect for your team
- `eas-cli` installed and logged in (`npx eas login`)
- One-time EAS credential setup completed so production iOS builds can run without interactive Apple login

## 1.1) Enable automatic Expo builds from GitHub

This repository can now trigger a new iOS production build automatically on every push to `main` when mobile files change.

Required one-time setup:

1. Create an Expo access token from your Expo account.
2. Add it to GitHub repository secrets as `EXPO_TOKEN`.
3. Run one successful `eas build -p ios --profile production` manually on a trusted machine and complete any Apple credential prompts so EAS stores the required iOS build credentials remotely.
4. Run one successful `eas submit -p ios --profile production` manually on a trusted machine, or configure an App Store Connect API key in Expo, so non-interactive submissions can complete from CI.

Notes:
- Automatic builds use `.github/workflows/mobile-eas-build.yml`.
- The workflow triggers `eas build --platform ios --profile production --auto-submit --non-interactive --no-wait`.
- If EAS still needs missing Apple build or App Store Connect submit credentials, the GitHub workflow will fail until the one-time manual setup is finished.

## 2) Configure production environment values

Create a local `.env` for builds (or use EAS secrets) with production endpoints:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com
EXPO_PUBLIC_WEBSOCKET_URL=wss://your-backend-domain.com
EXPO_PUBLIC_TWITTER_CLIENT_ID=...
EXPO_PUBLIC_TWITTER_REDIRECT_URI=irlobby://auth/twitter
EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN=...
# Optional but recommended for production: enables Sentry crash + perf reporting.
EXPO_PUBLIC_SENTRY_DSN=...
```

Notes:
- `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_WEBSOCKET_URL` must point to your live backend.
- Backend must support HTTPS/WSS and include required CORS/host settings.

## 2.1) Configure Twitter/X login for standalone iOS builds

The mobile app uses a backend-owned Twitter OAuth flow. For standalone/TestFlight builds, the app deep link must remain `irlobby://auth/twitter`.

Required setup:

1. Set backend env vars `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`.
2. Register the backend callback URL in the Twitter/X developer portal:
	- Local example: `http://localhost:8000/api/auth/twitter/callback/`
	- Production example: `https://your-backend-domain.com/api/auth/twitter/callback/`
3. Set `EXPO_PUBLIC_TWITTER_REDIRECT_URI=irlobby://auth/twitter` for the mobile app if you want an explicit runtime value.

Notes:
- The backend callback exchanges the Twitter authorization code and then redirects back into the app with app JWTs.
- This flow is intended for standalone/TestFlight builds. Expo Go callback URLs are not part of the supported release path.

## 3) Confirm app identity

Current bundle identifier is set in `app.config.ts`:
- iOS: `com.irlobby.app`

Make sure this matches the App ID in Apple Developer + App Store Connect.

## 4) Build production iOS binary

From `apps/mobile`:

```bash
npm install
npm run build:ios
```

This runs `eas build -p ios --profile production`.

For automated builds, pushes to `main` that touch `apps/mobile/**` or the root `package-lock.json` will submit the same production build through GitHub Actions.

## 5) Submit to App Store Connect

```bash
npm run submit:ios
```

This runs `eas submit -p ios --profile production`.

If you rely on GitHub Actions, the same submit step now runs automatically after a successful production iOS build because the workflow uses EAS auto-submit.

## 6) App Store Connect metadata

Complete before submitting for review:
- App name, subtitle, description, keywords
- Privacy policy URL
- Support URL and marketing URL (if available)
- Screenshots for required iPhone sizes
- App privacy questionnaire answers

> Copy-ready metadata lives in [`store/metadata/`](./store/metadata/).
> Privacy questionnaire reference: [`store/metadata/privacy-questionnaire.md`](./store/metadata/privacy-questionnaire.md).
> Reviewer demo account (App Privacy → Sign-In Information): [`store/metadata/reviewer-demo-account.md`](./store/metadata/reviewer-demo-account.md).
> Privacy Policy + Support pages are committed at `site/privacy.html` and `site/support.html` — host them at `https://irlobby.com/privacy` and `https://irlobby.com/support`.
> Screenshot capture guide: [`store/screenshots/README.md`](./store/screenshots/README.md).

### Pre-submission sanity check

Run before every release build:

```bash
cd apps/mobile
npm run presubmit
```

This validates the icon, runs typecheck + tests, scans for debug logs, and verifies metadata length limits.

## 7) Backend production requirements

Ensure backend env/config is production-ready:
- `DEBUG=False`
- Valid `ALLOWED_HOSTS`
- Correct `CORS_ALLOWED_ORIGINS`
- Production database configured
- HTTPS enabled (required for reliable mobile networking)

## 8) Review-critical checks

- Permission prompts are justified and accurate (camera/location/photos)
- Sign in and registration flows work against production backend
- Password reset links open correct frontend/app route
- App handles API downtime gracefully (errors/retries)

## 9) TestFlight first, then App Review

Recommended flow:
1. Upload build
2. Add internal testers
3. Validate onboarding/auth/activity flows
4. Submit to external testers (optional)
5. Submit for App Review
