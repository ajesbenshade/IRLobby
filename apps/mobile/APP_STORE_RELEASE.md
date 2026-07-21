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

## 1.2) Week 1 launch ops (credentials + first production build)

Engineering can ship Sentry + funnel analytics in code, but these ops steps are still required before TestFlight auth validation:

1. **Apple Developer** → Identifiers → App ID `com.irlobby.app` → enable **Sign In with Apple**.
2. **Google Cloud Console** → create OAuth client IDs for iOS (`com.irlobby.app`), Android (`com.irlobby.app` + SHA-1), and Web.
3. Set **backend production** env:
   - `APPLE_CLIENT_ID=com.irlobby.app`
   - `GOOGLE_IOS_CLIENT_ID=...`
   - `GOOGLE_ANDROID_CLIENT_ID=...`
   - `GOOGLE_WEB_CLIENT_ID=...`
   - Confirm `SENTRY_DSN` is set for backend crashes.
4. Set **EAS / GitHub** build env (or Expo secrets):
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_SENTRY_DSN` (mobile Sentry project DSN)
   - Optional for source maps: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
5. From `apps/mobile`, run one manual production build + submit so Apple credentials are stored:
   ```bash
   npm run build:ios
   npm run submit:ios
   ```
6. Confirm in Sentry that a mobile `app_open` event appears after installing the TestFlight build.

Done when: TestFlight build is installed, Apple/Google/X/email login can be attempted against `https://liyf.app`, and Sentry shows mobile sessions/events.

## 2) Configure production environment values

Create a local `.env` for builds (or use EAS secrets) with production endpoints:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com
EXPO_PUBLIC_WEBSOCKET_URL=wss://your-backend-domain.com
EXPO_PUBLIC_TWITTER_CLIENT_ID=...
EXPO_PUBLIC_TWITTER_REDIRECT_URI=irlobby://auth/twitter
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN=...
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
- Failed or cancelled OAuth attempts redirect back to the app with an `error` query param so the login screen can show a message.

## 2.2) Configure Sign in with Apple

Sign in with Apple is required for App Review when other third-party login options (such as Continue with X) are offered.

Required setup:

1. In Apple Developer → Identifiers → your App ID (`com.irlobby.app`), enable **Sign In with Apple**.
2. Set backend env var `APPLE_CLIENT_ID=com.irlobby.app` (must match the iOS bundle identifier used as the token audience).
3. Rebuild the iOS binary after enabling `usesAppleSignIn` / the `expo-apple-authentication` plugin (already configured in `app.config.ts`).

Notes:
- The app sends Apple's `identityToken` to `POST /api/auth/apple/signin/`.
- The backend verifies the token against Apple's JWKS and issues IRLobby JWTs.
- Apple only returns name/email on the first successful authorization; later sign-ins rely on the stable `sub` claim.

## 2.3) Configure Google Sign-In

Google sign-in uses `expo-auth-session` to obtain a Google ID token, then exchanges it with the backend.

Required setup:

1. In Google Cloud Console, create OAuth 2.0 client IDs:
	- iOS client (bundle ID `com.irlobby.app`)
	- Android client (package `com.irlobby.app` + SHA-1)
	- Web client (optional fallback / shared audience)
2. Set backend env vars to the same client IDs so token audience checks succeed:
	- `GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com`
	- `GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com`
	- `GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com`
	- Or `GOOGLE_CLIENT_IDS=id1,id2,id3`
3. Set matching mobile build env vars:
	- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
	- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
	- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
4. Rebuild the app so the reversed iOS client ID URL scheme is embedded (configured automatically from `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `app.config.ts`).

Notes:
- The app posts the Google `id_token` to `POST /api/auth/google/signin/`.
- The backend verifies the token against Google's JWKS and issues IRLobby JWTs.
- The Continue with Google button is hidden until a platform client ID is present in the mobile config.

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
- Sign in with Apple works on a physical iOS device / TestFlight build
- Continue with Google returns tokens against production
- Continue with X returns to the app with tokens (or a clear error) against production
- Password reset links open correct frontend/app route
- App handles API downtime gracefully (errors/retries)

## 9) TestFlight first, then App Review

Recommended flow:
1. Upload build
2. Add internal testers
3. Validate onboarding/auth/activity flows
4. Submit to external testers (optional)
5. Submit for App Review
