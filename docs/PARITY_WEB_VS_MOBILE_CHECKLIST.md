# IRLobby Parity Checklist (Web + Mobile)

Use this checklist to validate behavior + UX parity across platforms, plus backend API payload parity.

## Known constraints (current backend)

- Activity create requires: `description`, `latitude`, and `longitude`.
- Activity `images` is stored as a JSON list of strings (no upload endpoint). For now, clients should send data URLs (or stable HTTPS URLs) — not `blob:` URLs (web) or `file://` URIs (mobile).

---

## Onboarding

### Routing + access
- [ ] Authenticated user with onboardingCompleted = false is forced into onboarding (cannot access main app).
- [ ] Authenticated user with onboardingCompleted = true bypasses onboarding and lands in main app.
- [ ] Unauthenticated user cannot access onboarding (redirects to auth/landing).

### Core fields parity
- [ ] Bio: editable, saved, and reloaded correctly.
- [ ] City: editable, saved, and reloaded correctly.
- [ ] Age range: editable, saved, and reloaded correctly.
- [ ] Interests:
  - [ ] Add interest works via button and keyboard (where applicable).
  - [ ] Remove interest works.
  - [ ] Max interests enforced at 20.
  - [ ] Whitespace trimming is consistent (no empty/duplicate interests stored).
- [ ] Activity preferences:
  - [ ] Indoor / Outdoor / Prefer small groups / Weekend preferred toggles persist.
  - [ ] Toggle defaults match intended parity between platforms.

### Photos parity
- [ ] Profile photo / avatar:
  - [ ] Add/change flow works.
  - [ ] Preview renders.
  - [ ] Saved value persists after refresh/relogin.
- [ ] Photo album:
  - [ ] Add photos up to 12 (limit enforced).
  - [ ] Remove photo works.
  - [ ] Saved album persists after refresh/relogin.
  - [ ] Limit messaging/feedback is user-visible when exceeded.

### Invite friends parity
- [ ] Create invite link works with optional name + required contact value.
- [ ] Channel selection behavior is consistent (explicit channel vs inferred channel).
- [ ] Successful invite provides a shareable output and clears inputs.
- [ ] Error states show a user-visible message and allow retry.

### Save / complete behavior
- [ ] “Skip for now” completes onboarding state consistently (onboarding_completed becomes true).
- [ ] “Complete onboarding” completes onboarding state consistently (onboarding_completed becomes true).
- [ ] After completion, user is routed into main app and does not get stuck in onboarding loop.
- [ ] On completion, profile refresh happens so the app reflects updated user data.

### Required behavior states (both platforms)
- [ ] Loading state while save is in-flight (button disabled / spinner).
- [ ] Error state on failed save with user-visible recovery (retry possible).
- [ ] Session expiry handling is safe (re-auth path works without crashes).

---

## Bottom Nav

### Tabs present + labels
- [ ] Discover tab exists and navigates to the discovery feed.
- [ ] Matches tab exists and navigates to matches list.
- [ ] Create tab exists and navigates to create activity.
- [ ] My Events tab exists and navigates to user activities.
- [ ] Profile tab exists and navigates to profile screen.

### Navigation behavior
- [ ] Active tab styling/state is correct and updates on navigation.
- [ ] Switching tabs preserves app stability (no blank screens, no console errors).
- [ ] Returning from nested screens returns to the expected tab context.
- [ ] Chat entry/exit is consistent:
  - [ ] From Matches to Chat is possible.
  - [ ] Back from Chat returns to Matches context (or equivalent).

### Layout + safe area
- [ ] Bottom nav does not overlap primary actions or content.
- [ ] Safe area / bottom inset behavior is correct on devices with home indicator.
- [ ] Create screen and Profile screen include bottom padding offset so content isn’t obscured.

### Required behavior states (both platforms)
- [ ] Loading state for lazy-loaded screens is user-visible and not jarring.
- [ ] Error boundary/recovery does not trap the user behind an un-dismissable state.

---

## Profile

### Display parity
- [ ] Avatar renders (fallback initials if missing).
- [ ] Name display is consistent (first + last when present, fallback when absent).
- [ ] Bio shows when present; hidden/empty state is reasonable when absent.
- [ ] Interests render with an empty state when none are present.
- [ ] Activity stats area is consistent (values either real or clearly placeholders across platforms).
- [ ] Reviews summary/entry point is present and navigable.

### Edit profile parity
- [ ] First name update persists after refresh/relogin.
- [ ] Last name update persists after refresh/relogin.
- [ ] Bio update persists after refresh/relogin.
- [ ] City/location update persists after refresh/relogin.
- [ ] Avatar update persists after refresh/relogin.
- [ ] Interests update persists after refresh/relogin (max 20 enforced).
- [ ] Photo album update persists after refresh/relogin (max 12 enforced).

### Connections parity
- [ ] “Connections” entry point exists.
- [ ] Loading / empty / error / retry states are present and usable.
- [ ] Connection details show consistent semantics (matched/confirmed state, labels).

### Settings/help/support navigation parity
- [ ] Settings is reachable from Profile.
- [ ] Reviews is reachable from Profile.
- [ ] Help & Support is reachable from Profile.
- [ ] Privacy Policy and Terms navigation is available where intended.

### Sign out parity
- [ ] Sign out is available.
- [ ] Sign out clears session and routes user to landing/auth reliably.
- [ ] Post-logout protected screens are not accessible without re-auth.

### Required behavior states (both platforms)
- [ ] Loading state while fetching profile.
- [ ] Error state if profile fetch fails with a retry path.
- [ ] Session-expired flow recovers cleanly.

---

## Create Activity

### Form fields parity
- [ ] Title is required and validated.
- [ ] Description behavior matches backend requirements and validates consistently.
- [ ] Category selection exists and is saved.
- [ ] Date/time input:
  - [ ] Start date/time is required.
  - [ ] Format is valid and sent as ISO string to backend.
  - [ ] End time (if supported) is validated (end > start).
- [ ] Location is required.
- [ ] Coordinates are provided (latitude + longitude) to satisfy backend requirements.
- [ ] Capacity is required and limited to 1–10.
- [ ] Visibility:
  - [ ] Everyone / friends / friendsOfFriends options exist.
  - [ ] Default is everyone if none selected.
  - [ ] Private flag semantics match visibility (is_private / isPrivate).
- [ ] Requires approval toggle exists and persists in created activity.

### Photos parity (activity images)
- [ ] Up to 5 images enforced.
- [ ] Removing selected images works.
- [ ] Image payload format is consistent across platforms (data URLs or stable HTTPS URLs).
- [ ] Created activity returns images array and both platforms can render it.

### Submit behavior
- [ ] Success shows confirmation and routes user appropriately (back to Discover or equivalent).
- [ ] Activity list refresh happens after create (Discover and Hosted/My Events update).
- [ ] Errors show a user-visible message and allow retry.
- [ ] Submit button shows loading state and prevents double-submit.

---

## API Payload Parity (Web + Mobile + Backend)

### Users: onboarding
- Endpoint: PATCH /api/users/onboarding/
- Payload keys (snake_case preferred; backend also aliases common camelCase)
- Checks:
  - [ ] Interests max 20 enforced.
  - [ ] Photo album max 12 enforced.
  - [ ] Both clients can read back onboarding data consistently after save.

### Users: invites
- Endpoint: POST /api/users/invites/
- Checks:
  - [ ] Web and mobile produce the same invite payload keys.
  - [ ] Response includes token and is surfaced to user in a shareable way.

### Activities: create
- Endpoint: POST /api/activities/
- Checks:
  - [ ] Both platforms send `description`, `latitude`, and `longitude`.
  - [ ] Both platforms send time/date in ISO format.
  - [ ] Both platforms send images as data URLs or stable HTTPS URLs.

---

## File Map

- shared/schema.ts
- scripts/check-api-contract.mjs

- client/src/pages/onboarding.tsx
- client/src/pages/profile.tsx
- client/src/pages/create-activity.tsx

- irlobby_backend/activities/models.py
- irlobby_backend/activities/serializers.py
- irlobby_backend/activities/views.py

- irlobby_mobile/src/screens/main/OnboardingScreen.tsx
- irlobby_mobile/src/screens/main/ProfileScreen.tsx
- irlobby_mobile/src/screens/main/CreateActivityScreen.tsx
- irlobby_mobile/src/services/activityService.ts
