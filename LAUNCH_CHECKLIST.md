# 🚀 IRLobby App Store Launch — Quick Start

All technical prep is complete! ✅ This document consolidates the remaining manual steps to get IRLobby live on the App Store.

**Estimated time:** 1–2 hours  
**Target:** Submit for App Review within 24 hours

---

## 📋 Quick Checklist

- [ ] **Phase 1 (5 min):** Set up GitHub CI builds
  - [ ] Generate EXPO_TOKEN from Expo dashboard
  - [ ] Add to GitHub secrets
  - [ ] Run one manual EAS build on your machine

- [ ] **Phase 2 (10 min):** Create production reviewer account
  - [ ] Create `app-review@irlobby.com` on backend
  - [ ] Document credentials in repo

- [ ] **Phase 3 (20 min):** Configure App Store Connect
  - [ ] Upload five screenshots
  - [ ] Fill privacy questionnaire
  - [ ] Add reviewer account + URLs

- [ ] **Phase 4 (30 min):** Test on TestFlight
  - [ ] Trigger CI build (automatic now)
  - [ ] Smoke test all features
  - [ ] Verify no crashes

- [ ] **Phase 5 (submit):** Submit for App Review
  - [ ] Final review of all metadata
  - [ ] Click "Submit for Review" in App Store Connect
  - [ ] Monitor review feedback

---

## 🔐 Phase 1: GitHub CI Setup (5 min)

This enables automatic builds on every push to `main`.

### 1.1 Generate Expo Personal Access Token
```
1. Go to https://expo.dev/accounts/ajesbenshade/settings/tokens
2. Click "Create Access Token"
3. Name: "GitHub CI - IRLobby Mobile"
4. Copy the token (save it, you'll only see it once)
```

### 1.2 Add EXPO_TOKEN to GitHub
```
1. Go to https://github.com/ajesbenshade/IRLobby
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: EXPO_TOKEN
5. Value: [paste token from 1.1]
6. Save
```

### 1.3 Bootstrap iOS credentials (run once, ~15 min)
```bash
cd IRLobby/IRLobby/apps/mobile
eas build -p ios --profile production
```
When prompted:
- "Do you want to log in to your Apple account?" → **Yes**
- Enter Apple Developer ID + password
- Let EAS generate certificates and profiles
- These are stored in Expo; CI will use them automatically

✅ After this completes once, CI builds will work automatically.

---

## 👤 Phase 2: Reviewer Demo Account (10 min)

Apple needs a test account to review your app.

### 2.1 Create account on production backend
```
Email: app-review@irlobby.com
Password: [strong password]
Profile: Name = "Reviewer"
Vibe Quiz: Complete it with realistic preferences
```

### 2.2 Seed a couple test activities (optional)
Create 1–2 sample activities from another account so the reviewer can see matches and test the chat feature.

### 2.3 Save credentials in repo
Edit `apps/mobile/store/metadata/reviewer-demo-account.md`:
```markdown
# App Store Reviewer Demo Account

**Email:** app-review@irlobby.com
**Password:** [strong password]
**Created:** [date]

## Test steps for reviewer
1. Sign in with above credentials
2. Complete Vibe Quiz
3. Tap Discover → swipe through activities
4. Match → observe celebration
5. Tap Chat to message match
6. Tap Profile to view user data
```

---

## 📱 Phase 3: App Store Connect Setup (20 min)

Configure the App Store listing with screenshots and metadata.

### 3.1 Log into App Store Connect
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
All the following are already filled in `apps/mobile/store/metadata/`:
- **App Name:** IRLobby ✓
- **Subtitle:** Tinder for real IRL hangouts ✓
- **Description:** [auto-populated] ✓
- **Keywords:** [auto-populated] ✓
- **Release Notes:** What's new in this version

You can update release notes if desired. Otherwise, leave as-is.

✅ Save all changes in App Store Connect.

---

## 🧪 Phase 4: TestFlight Smoke Test (30 min)

Verify the app works before submitting to Apple.

### 4.1 Trigger a build
Push changes to GitHub (or any commit will trigger the workflow):
```bash
cd IRLobby/IRLobby
git add .
git commit -m "App Store launch prep"
git push origin main
```

The `.github/workflows/mobile-eas-build.yml` workflow will:
1. Build the iOS app (~10–15 min)
2. Auto-submit to TestFlight (if you configured App Store Connect API key)
3. Or you can manually submit via: `eas submit -p ios --profile production`

**Monitor build progress:**
- Expo Dashboard: https://expo.dev/projects/9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe/builds
- Look for the latest iOS build

### 4.2 Accept TestFlight invite
Once build completes:
1. You'll receive a TestFlight invite (via email)
2. Open the link and tap "Accept"
3. Install the app on your iPhone or simulator

### 4.3 Smoke test checklist
On the TestFlight build, verify:
- ✓ App launches without crashing
- ✓ Sign-in/onboarding completes
- ✓ Vibe Quiz works
- ✓ Discover tab loads and shows activities
- ✓ Can swipe and match
- ✓ Chat opens and sends messages
- ✓ Profile shows user data
- ✓ Settings/logout works
- ✓ No crash reports in Sentry

🔴 **If any failures:** Fix in `apps/mobile/`, commit, push, and trigger another build.

✅ **If all pass:** Ready for App Review!

---

## 🎯 Phase 5: Submit for App Review

### 5.1 Final review
In App Store Connect, double-check:
- ✓ All five screenshots uploaded
- ✓ App name, subtitle, description filled in
- ✓ Privacy policy URL works
- ✓ Support URL works
- ✓ Reviewer account credentials added
- ✓ Metadata looks good

### 5.2 Submit
In App Store Connect:
1. Go to "Version history" for your app version
2. Click "Submit for Review"
3. Select release type: **Full Release** (for first launch)
4. Review and confirm

✅ **Submitted!**

### 5.3 Wait for review
Apple typically reviews within 24–48 hours:

**✅ Approved:**
- App goes live on App Store automatically
- You'll receive email confirmation

**❌ Rejected:**
- You'll get feedback in "Resolution Center"
- Fix the issue (usually screenshots, crashes, or privacy policy)
- Resubmit for review

**⏳ More Info Needed:**
- Apple will ask clarifying questions
- Respond promptly
- Usually leads to approval or rejection

---

## 📚 Reference Docs

All pre-written in the repo:
- `apps/mobile/APP_STORE_RELEASE.md` — Detailed technical checklist
- `apps/mobile/store/metadata/privacy-questionnaire.md` — Privacy policy template
- `apps/mobile/store/metadata/reviewer-demo-account.md` — Reviewer credentials template
- `.github/workflows/mobile-eas-build.yml` — CI/CD workflow (automatic builds)
- `apps/mobile/scripts/pre-submit-check.sh` — Presubmit validation (already all green ✅)

---

## 🆘 Troubleshooting

### EAS build fails
Check `.github/workflows/mobile-eas-build.yml` run logs: https://github.com/ajesbenshade/IRLobby/actions

Common issues:
- EXPO_TOKEN not set in GitHub → add it to secrets
- Apple credentials expired → run `eas build -p ios --profile production` once manually
- Missing metadata files → check `apps/mobile/store/metadata/`

### TestFlight build doesn't appear
- Wait 5–10 min after build completes
- Check email for TestFlight invite
- Ensure your Apple ID is added as tester in App Store Connect

### App crashes on TestFlight
1. Check Sentry for crash reports: https://sentry.io/organizations/irlobby/issues/
2. Fix the issue in code
3. Commit, push, trigger new build
4. Retest on TestFlight

### App Store review rejected
Check "Resolution Center" in App Store Connect for details. Common reasons:
- Screenshots don't match functionality → update screenshots
- Privacy policy inaccessible → verify URL works
- Missing reviewer account → add it under Privacy → Sign-In
- Crashes on reviewer's device → check Sentry and fix

Fix, then resubmit.

---

## ✨ Key Dates & Timeline

- **Today:** Complete Phases 1–3 (manual setup)
- **Tomorrow:** Trigger TestFlight build & smoke test (Phase 4)
- **Day 2:** Submit for App Review (Phase 5)
- **Day 3–4:** Apple review (typically 24–48 hours)
- **Day 4 or later:** 🎉 App goes live on App Store!

---

## 🔗 Quick Links

| Resource | URL |
|----------|-----|
| **Expo Tokens** | https://expo.dev/accounts/ajesbenshade/settings/tokens |
| **GitHub Secrets** | https://github.com/ajesbenshade/IRLobby/settings/secrets/actions |
| **Expo Dashboard** | https://expo.dev/projects/9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe |
| **App Store Connect** | https://appstoreconnect.apple.com |
| **Sentry (Crash Reports)** | https://sentry.io/organizations/irlobby/issues/ |
| **GitHub Actions** | https://github.com/ajesbenshade/IRLobby/actions |

---

**Questions?** Check `APP_STORE_RELEASE.md` for more detailed technical guidance.

Good luck! 🚀
