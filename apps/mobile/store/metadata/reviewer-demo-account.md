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
2. Home shows 8 upcoming activities (6 plus two Require-approval gatherings, see below) around Cupertino, CA, hosted by 4 other seeded users
   (Maya, Jordan, Priya, Sam). The review account skips the nearby-radius filter, so this
   content appears wherever the review device is located.
3. The reviewer can:
   - Browse and swipe activities, and join one (they are already confirmed for the hike)
   - Open the existing chat with Maya (a match with message history) and send messages
   - See their own hosted activity ("Sunday Farmers Market Stroll") with a pending join request
   - Edit profile, upload a photo
   - Trigger account deletion from Settings → Delete account (do not delete this account; it is shared)

## Second reviewer account

`seed_review_account` also creates a second account so a reviewer can try both sides of friends, 1:1 chat, and join requests.

- **Email**: `app-review2@irlobby.com` (username `app_review2`)
- **Password**: the same as the first account unless `--password2` or `REVIEW_ACCOUNT_PASSWORD2` is set
  (the option wins over the env var, which wins over the shared password).
- Already friends with the first account, with a short 1:1 chat between the two (Chats tab).
- Has asked to join "Neighborhood Potluck (host approves guests)", a Require-approval gathering hosted by Sam; the request shows as pending.
- The first account hosts "Hosting demo: Porch Games (you approve guests)", with a pending request from Priya to approve or decline.
- Safe to re-run: the seed rebuilds both accounts' content without duplicates. Home now shows 8 upcoming activities for the first account (the two Require-approval gatherings are added).

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
