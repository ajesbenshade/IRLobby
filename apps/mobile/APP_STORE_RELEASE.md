# iOS App Store Release Checklist (IRLobby Mobile)

Use this checklist to publish `irlobby_mobile` with your Apple Developer account.

## 1) Accounts and tools

- Active Apple Developer Program membership
- Access to App Store Connect for your team
- `eas-cli` installed and logged in (`npx eas login`)

## 2) Configure production environment values

Create a local `.env` for builds (or use EAS secrets) with production endpoints:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://your-backend-domain.com
EXPO_PUBLIC_WEBSOCKET_URL=wss://your-backend-domain.com
EXPO_PUBLIC_TWITTER_CLIENT_ID=...
EXPO_PUBLIC_TWITTER_REDIRECT_URI=irlobby://auth/twitter
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

Notes:
- `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_WEBSOCKET_URL` must point to your live backend.
- Backend must support HTTPS/WSS and include required CORS/host settings.

## 3) Confirm app identity

Current bundle identifier is set in `app.config.ts`:
- iOS: `com.irlobby.app`

Make sure this matches the App ID in Apple Developer + App Store Connect.

## 4) Build production iOS binary

From `irlobby_mobile`:

```bash
npm install
npm run build:ios
```

This runs `eas build -p ios --profile production`.

## 5) Submit to App Store Connect

```bash
npm run submit:ios
```

This runs `eas submit -p ios --profile production`.

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
- Password reset links open correct frontend/app route
- App handles API downtime gracefully (errors/retries)

## 9) TestFlight first, then App Review

Recommended flow:
1. Upload build
2. Add internal testers
3. Validate onboarding/auth/activity flows
4. Submit to external testers (optional)
5. Submit for App Review
