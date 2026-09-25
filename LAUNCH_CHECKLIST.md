# IRLobby App Store Launch Checklist

This document lists the remaining manual steps to publish IRLobby on the App Store.

**Estimated time:** 1–2 hours  
**Target:** Submit for App Review within 24 hours

---

## Quick checklist

- [ ] **Phase 1 (5 min):** Set up GitHub CI builds
  - [ ] Generate `EXPO_TOKEN` from the Expo dashboard
  - [ ] Add the token to GitHub secrets
  - [ ] Run one manual EAS build on your machine

- [ ] **Phase 2 (10 min):** Create production reviewer account
  - [ ] Create `app-review@irlobby.com` on the backend
  - [ ] Document credentials in the repository

- [ ] **Phase 3 (20 min):** Configure App Store Connect
  - [ ] Upload five screenshots
  - [ ] Complete the privacy questionnaire
  - [ ] Add the reviewer account and URLs

- [ ] **Phase 4 (30 min):** Test on TestFlight
  - [ ] Trigger a CI build
  - [ ] Smoke-test all features
  - [ ] Confirm that the app does not crash

- [ ] **Phase 5 (submit):** Submit for App Review
  - [ ] Review all metadata
  - [ ] Select **Submit for Review** in App Store Connect
  - [ ] Monitor review feedback

---

## Phase 1: GitHub CI setup (5 min)

This setup starts automatic builds on every push to `main`.

### 1.1 Generate Expo personal access token

1. Open https://expo.dev/accounts/ajesbenshade/settings/tokens
2. Select **Create Access Token**
3. Set the name to `GitHub CI - IRLobby Mobile`
4. Copy the token. Store the token. You see the token only once.

### 1.2 Add EXPO_TOKEN to GitHub

1. Open https://github.com/ajesbenshade/IRLobby
2. Open **Settings** → **Secrets and variables** → **Actions**
3. Select **New repository secret**
4. Set the name to `EXPO_TOKEN`
5. Paste the token from step 1.1 as the value
6. Save the secret

### 1.3 Bootstrap iOS credentials (run once, about 15 min)

```bash
cd IRLobby/IRLobby/apps/mobile
eas build -p ios --profile production
```

When the prompt appears:

- For "Do you want to log in to your Apple account?" select **Yes**
- Enter your Apple Developer ID and password
- Let EAS generate certificates and profiles

EAS stores these credentials in Expo. CI uses them automatically.

After this step completes once, CI builds run without a manual credential step.

---

## Phase 2: Reviewer demo account (10 min)

Apple requires a test account to review the app.

### 2.1 Create account on production backend

```
Email: app-review@irlobby.com
Password: [strong password]
Profile: Name = "Reviewer"
Vibe Quiz: Complete with realistic preferences
```

### 2.2 Seed test activities

On production (also runs automatically on full backend deploy):

```bash
cd irlobby_backend
# App Review demo account (requires REVIEW_ACCOUNT_PASSWORD)
python manage.py seed_review_account

# Beta tester swipe deck — photos, descriptions, locations (default hub: Youngstown)
python manage.py seed_beta_events --hub youngstown
```

`seed_beta_events` creates approved activities with Unsplash photos so Discover has cards to swipe.

### 2.3 Save credentials in the repository

Edit `apps/mobile/store/metadata/reviewer-demo-account.md`:

```markdown
# App Store Reviewer Demo Account

**Email:** app-review@irlobby.com
**Password:** [strong password]
**Created:** [date]

## Test steps for reviewer
1. Sign in with the credentials above
2. Complete Vibe Quiz
3. Tap Discover → swipe through activities
4. Match → observe celebration
5. Tap Chat to message the match
6. Tap Profile to view user data
```

---

## Phase 3: App Store Connect setup (20 min)

Configure the App Store listing with screenshots and metadata.

### 3.1 Sign in to App Store Connect

```
https://appstoreconnect.apple.com
Select: Apps → IRLobby
```

### 3.2 Upload five screenshots

```
Go to: App Store → iOS App → iPhone Screenshots (6.9 inch)
Upload these five files (in order):
1. apps/mobile/store/screenshots/01-vibe-quiz.png
2. apps/mobile/store/screenshots/02-discover-swipe.png
3. apps/mobile/store/screenshots/03-match-celebration.png
4. apps/mobile/store/screenshots/04-chat.png
5. apps/mobile/store/screenshots/05-profile-or-results.png
```

### 3.3 Configure privacy

```
Go to: Privacy → App Privacy
Follow instructions in: apps/mobile/store/metadata/privacy-questionnaire.md
```

### 3.4 Add reviewer sign-in (choose one)

```
Option A (recommended):
- Check "This app requires a login"
- Add test account type
- Email: app-review@irlobby.com
- Password: [from Phase 2]

Option B (if no auth needed for reviewer):
- Check "This app does NOT require a login"
```

### 3.5 Verify URLs

```
App Information:
- Privacy Policy URL: https://irlobby.com/privacy
- Support URL: https://irlobby.com/support
- Marketing URL: https://irlobby.com
```

### 3.6 Finalize app metadata

These values are already filled in `apps/mobile/store/metadata/`:

- **App Name:** IRLobby
- **Subtitle:** Tinder for real IRL hangouts
- **Description:** [auto-populated]
- **Keywords:** [auto-populated]
- **Release Notes:** What is new in this version

Update release notes if needed. Otherwise leave them unchanged.

Save all changes in App Store Connect.

---

## Phase 4: TestFlight smoke test (30 min)

Verify the app before you submit it to Apple.

### 4.1 Trigger a build

Push changes to GitHub. Any commit on `main` can trigger the workflow:

```bash
cd IRLobby/IRLobby
git add .
git commit -m "App Store launch prep"
git push origin main
```

The `.github/workflows/mobile-eas-build.yml` workflow does this:

1. Builds the iOS app (about 10–15 min)
2. Submits to TestFlight if you configured an App Store Connect API key
3. Or you submit manually with: `eas submit -p ios --profile production`

Monitor build progress:

- Expo Dashboard: https://expo.dev/projects/9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe/builds
- Open the latest iOS build

### 4.2 Accept TestFlight invite

After the build completes:

1. Open the TestFlight invite email
2. Open the link and select **Accept**
3. Install the app on your iPhone or simulator

### 4.3 Smoke test checklist

On the TestFlight build, verify these items:

- [ ] App launches without a crash
- [ ] Sign-in and onboarding complete
- [ ] Vibe Quiz works
- [ ] Discover tab loads and shows activities
- [ ] Swipe and match work
- [ ] Chat opens and sends messages
- [ ] Profile shows user data
- [ ] Settings and logout work
- [ ] Sentry shows no crash reports

If a check fails: fix the issue in `apps/mobile/`, commit, push, and trigger another build.

If all checks pass: continue to App Review.

---

## Phase 5: Submit for App Review

### 5.1 Final review

In App Store Connect, verify:

- [ ] All five screenshots are uploaded
- [ ] App name, subtitle, and description are complete
- [ ] Privacy policy URL works
- [ ] Support URL works
- [ ] Reviewer account credentials are added
- [ ] Metadata is correct

### 5.2 Submit

In App Store Connect:

1. Open **Version history** for your app version
2. Select **Submit for Review**
3. Select release type: **Full Release** (for first launch)
4. Review and confirm

### 5.3 Wait for review

Apple typically reviews within 24–48 hours.

**Approved:**

- The app goes live on the App Store automatically
- You receive an email confirmation

**Rejected:**

- Feedback appears in **Resolution Center**
- Fix the issue (often screenshots, crashes, or privacy policy)
- Resubmit for review

**More information needed:**

- Apple asks clarifying questions
- Respond promptly
- The response usually leads to approval or rejection

---

## Reference docs

These files are in the repository:

- `apps/mobile/APP_STORE_RELEASE.md` — detailed technical checklist
- `apps/mobile/store/metadata/privacy-questionnaire.md` — privacy questionnaire template
- `apps/mobile/store/metadata/reviewer-demo-account.md` — reviewer credentials template
- `.github/workflows/mobile-eas-build.yml` — CI/CD workflow for automatic builds
- `apps/mobile/scripts/pre-submit-check.sh` — presubmit validation

---

## Troubleshooting

### EAS build fails

Check `.github/workflows/mobile-eas-build.yml` run logs: https://github.com/ajesbenshade/IRLobby/actions

Common causes:

- `EXPO_TOKEN` is not set in GitHub — add it to secrets
- Apple credentials expired — run `eas build -p ios --profile production` once manually
- Metadata files are missing — check `apps/mobile/store/metadata/`

### TestFlight build does not appear

- Wait 5–10 min after the build completes
- Check email for a TestFlight invite
- Confirm that your Apple ID is added as a tester in App Store Connect

### App crashes on TestFlight

1. Check Sentry for crash reports: https://sentry.io/organizations/irlobby/issues/
2. Fix the issue in code
3. Commit, push, and trigger a new build
4. Retest on TestFlight

### App Store review rejected

Open **Resolution Center** in App Store Connect. Common causes:

- Screenshots do not match functionality — update screenshots
- Privacy policy is inaccessible — verify the URL
- Reviewer account is missing — add it under Privacy → Sign-In
- The app crashes on the reviewer device — check Sentry and fix

Fix the issue, then resubmit.

---

## Timeline

- **Day 0:** Complete Phases 1–3 (manual setup)
- **Day 1:** Trigger TestFlight build and smoke test (Phase 4)
- **Day 2:** Submit for App Review (Phase 5)
- **Day 3–4:** Apple review (typically 24–48 hours)
- **Day 4 or later:** App goes live on the App Store

---

## Quick links

| Resource | URL |
|----------|-----|
| Expo Tokens | https://expo.dev/accounts/ajesbenshade/settings/tokens |
| GitHub Secrets | https://github.com/ajesbenshade/IRLobby/settings/secrets/actions |
| Expo Dashboard | https://expo.dev/projects/9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe |
| App Store Connect | https://appstoreconnect.apple.com |
| Sentry (crash reports) | https://sentry.io/organizations/irlobby/issues/ |
| GitHub Actions | https://github.com/ajesbenshade/IRLobby/actions |

---

For more technical detail, see `APP_STORE_RELEASE.md`.
