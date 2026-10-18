# App Privacy Questionnaire (App Store Connect)

> Draft for The Foyer beta (build 94). Webmaster owns the final answers. Sentry only reports when `EXPO_PUBLIC_SENTRY_DSN` is set for the build.

Use this as a reference when you fill out the App Privacy section.

## Data Collected and Linked to User

- **Contact Info**: Email address (account creation, auth)
- **User Content**: Photos, messages (chat), profile content
- **Identifiers**: User ID
- **Location**: None sent to the server. `Use my location for maps` is on-device only and off by default.
- **Usage Data**: Product interaction (Sentry breadcrumbs, anonymized)
- **Diagnostics**: Crash data, performance data (Sentry)

## Data Used to Track You

- None.

## Purposes

- App Functionality: Email, User ID, User Content, Messages, birth date (age checks), church
- Analytics: Diagnostics, anonymized Usage Data (Sentry)

## Third Parties

- Sentry (crash + performance reporting)
- Mapbox (map tiles)
- Google and Apple (optional sign-in)

## Notes

- Location is requested only after the member turns on `Use my location for maps`, only while in use.
- Camera and Photo Library access is opt-in per upload.
- All chat content is stored on The Foyer backend. No third-party message processors.
