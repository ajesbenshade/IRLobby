# App Privacy Questionnaire (App Store Connect)

Use this as a reference when filling out the App Privacy section.

## Data Collected and Linked to User

- **Contact Info**: Email address (account creation, auth)
- **User Content**: Photos, messages (chat), profile content
- **Identifiers**: User ID
- **Location**: Coarse location (to surface nearby activities)
- **Usage Data**: Product interaction (Sentry breadcrumbs, anonymized)
- **Diagnostics**: Crash data, performance data (Sentry)

## Data Used to Track You

- None.

## Purposes

- App Functionality: Email, User ID, Location, User Content, Messages
- Analytics: Diagnostics, anonymized Usage Data (Sentry)

## Third Parties

- Sentry (crash + performance reporting)
- Mapbox (map tiles for nearby activities)
- Twitter/X (optional sign-in)

## Notes

- Location is requested only when in use (not background).
- Camera and Photo Library access is opt-in per upload.
- All chat content is stored on the IRLobby backend; no third-party message processors.
