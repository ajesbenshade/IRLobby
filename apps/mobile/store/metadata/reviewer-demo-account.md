# Reviewer Demo Account

Used for both Apple App Review (App Store Connect → your version → App Review Information → Sign-In Information) and Google Play (Play Console → App content → App access).

## Credentials

> **Action required:** Run `seed_review_account` on production before every submission (see Maintenance). It creates the account and all demo content.

- **Email**: `app-review@irlobby.com`
- **Password**: `<set in 1Password / shared secret store; paste into ASC + Play Console only>`
- **Display name**: `App Reviewer`
- **Region**: United States (account created with US zipcode for activity feed)

## What the reviewer will see after sign-in

1. Onboarding is marked complete, so they land directly on Home.
2. Home shows 6 upcoming activities around Cupertino, CA, hosted by 4 other seeded users
   (Maya, Jordan, Priya, Sam). Each activity includes photos, a full description, location,
   and tags. The review account skips the nearby-radius filter, so this content appears
   wherever the review device is located.
3. The reviewer can:
   - Browse and swipe activities, and join one (they are already confirmed for the hike)
   - Open the existing chat with Maya (a match with message history) and send messages
   - See their own hosted activity ("Sunday Farmers Market Stroll") with a pending join request
   - Edit profile, upload a photo
   - Trigger account deletion from Settings → Delete account (do not delete this account; it is shared)

## Notes for reviewers (paste verbatim into ASC / Play Console)

```
Sign in with email + password using the credentials above ("Continue with email" on the
login screen). Onboarding is pre-completed, so you land on the Home feed.

The account is pre-populated with other users, upcoming activities, an activity you have
joined, an activity you host (with a pending join request), and an existing chat with
another user under the Chats tab. Demo content is shown regardless of device location.

Location access ("While Using") and push notifications are optional.

Delete-account flow: Settings → Account → Delete account. Please do NOT confirm
deletion on this shared review account.
```

## Maintenance

- Rotate the password each release cycle and update both stores.
- Re-seed sample activities monthly so reviewers see fresh content.
- Before each submission (and if the account is locked, deleted, or its activities have
  passed), refresh it on the production backend. This resets the password, re-creates the
  demo users/activities with future dates, and rebuilds the chat:

  ```bash
  cd irlobby_backend
  REVIEW_ACCOUNT_PASSWORD='<password>' python manage.py seed_review_account
  ```
