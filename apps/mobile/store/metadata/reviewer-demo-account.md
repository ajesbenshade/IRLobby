# Reviewer Demo Account

Used for both Apple App Review (App Store Connect → App Privacy → Sign-In Information) and Google Play (Play Console → App content → App access).

## Credentials

> **Action required:** Create this account on production (`https://liyf.app`) before submitting. Replace placeholders below.

- **Email**: `app-review@irlobby.com`
- **Password**: `<set in 1Password / shared secret store; paste into ASC + Play Console only>`
- **Display name**: `App Reviewer`
- **Region**: United States (account created with US zipcode for activity feed)

## What the reviewer will see after sign-in

1. Onboarding is auto-completed for this account (vibe quiz answers pre-seeded).
2. Home tab shows seeded sample activities within ~5 mi of the seeded location.
3. The reviewer can:
   - Browse activities, swipe, and join one
   - Open a 1:1 chat with a seeded match
   - Edit profile, upload a photo
   - Trigger account deletion from Settings → Delete account (do NOT delete this account; it is shared)

## Notes for reviewers (paste verbatim into ASC / Play Console)

```
Sign in with the credentials above. Onboarding and the vibe quiz are pre-completed
so you land directly on the Home feed with seeded activities near the account's
default location. Twitter/X login is optional; email + password is sufficient.

To exercise location-aware features, allow "While Using" location access when
prompted. Push notifications are optional and not required for review.

Delete-account flow: Settings → Account → Delete account. Please do NOT confirm
deletion on this shared review account.
```

## Maintenance

- Rotate the password each release cycle and update both stores.
- Re-seed sample activities monthly so reviewers see fresh content.
- If the account is locked or rate-limited, regenerate via the backend management command:
  ```bash
  cd irlobby_backend
  python manage.py seed_review_account
  ```
  *(If this command does not yet exist, add it before the next submission.)*
