# Expo (EAS) Environment Variables for IRLobby

Use this when you build from **Expo dashboard → Build from GitHub** (not GitHub Actions).

GitHub secrets are not copied into Expo automatically. Add the same names in Expo.

## 1) Open Environment variables

1. Go to [expo.dev](https://expo.dev) → project **irlobby**
2. Open **Project settings** → **Environment variables**
3. Set Environment to **Production**
4. Select **Add variable** for each row below

## 2) Required variables (Production)

| Name | Visibility | Example value source |
|------|------------|----------------------|
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Sensitive | Google Cloud → iOS OAuth client |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Sensitive | Google Cloud → Android OAuth client |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Sensitive | Google Cloud → Web OAuth client |
| `EXPO_PUBLIC_TWITTER_CLIENT_ID` | Sensitive | GitHub secret `TWITTER_CLIENT_ID` or variable |
| `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN` | Sensitive | GitHub variable `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN` |

Already set in `eas.json` (do not duplicate in Expo):

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_WEBSOCKET_URL`
- `EXPO_PUBLIC_TWITTER_REDIRECT_URI`

## 3) Start a build from GitHub (Expo dashboard)

| Field | Value |
|-------|--------|
| **Base directory** | `apps/mobile` |
| **Git ref** | `main` |
| **EAS Build profile** | `production` |
| **Environment** | Production (or Default if linked) |
| **EAS Submit** | **Unchecked** (unless Play/App Store submit is configured) |

Uncheck **EAS Submit** until Google Play / App Store submit credentials are set up in Expo. Builds for testing Google login do not need submit.

## 4) Not used in the mobile app

Do not add these to Expo env for the app build:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET` — never ship OAuth client secrets in a mobile app
- `TWITTER_CLIENT_SECRET` — backend only
- `HETZNER_*` — server deploy only

## 5) Verify before building

After you save variables, start a build and confirm that the log includes:

```
Environment variables loaded ... EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, ...
```

If you still see only `EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_WEBSOCKET_URL, EXPO_PUBLIC_TWITTER_REDIRECT_URI`, the Google/Twitter/Mapbox vars are missing from the **Production** environment in Expo.

## 6) Google login (iOS TestFlight)

`app.config.ts` copies `EXPO_PUBLIC_GOOGLE_*` into `extra` at EAS build time. The app reads those values from `Constants.expoConfig.extra`, then falls back to `process.env.EXPO_PUBLIC_GOOGLE_*` if extra is empty.

iOS `useIdTokenAuthRequest` needs both:

- `iosClientId` — native OAuth client and reversed URL scheme (`com.googleusercontent.apps.<ios-client-id>:/oauthredirect`)
- `webClientId` — required for a reliable identity token (`id_token`)

If Google authorizes and the app still shows **Couldn't finish sign-in**, the toast body now includes the exchange error. A `Token audience … must be listed in backend GOOGLE_OAUTH_CLIENT_IDS` message means the server allow-list is missing that client ID (iOS, Android, and Web). Add the exact `aud` value, redeploy the API, and rebuild the app so extra contains all three `EXPO_PUBLIC_GOOGLE_*` IDs.

Do not App Store submit a Google-login test build unless that is requested separately.
