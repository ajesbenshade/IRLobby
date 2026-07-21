# Google Play Store Launch — IRLobby Android

This checklist covers the steps to publish IRLobby to Google Play Store.

**Target release:** Week of April 28, 2026  
**Estimated effort:** 2–3 hours

---

## Quick checklist

- [ ] **Phase 1 (5 min):** Android signing setup
  - [ ] Create a Google Play signing key (or use an existing key)
  - [ ] Create a Play Store service account JSON
  - [ ] Configure `eas.json` with the service account path

- [ ] **Phase 2 (10 min):** Generate Android screenshots
  - [ ] Capture five 1080×1920 PNG screenshots
  - [ ] Save files to `apps/mobile/store/screenshots-android/`

- [ ] **Phase 3 (15 min):** Create Play Store app entry
  - [ ] Create the app in Google Play Console
  - [ ] Verify package name: `com.irlobby.app`

- [ ] **Phase 4 (20 min):** Configure store listing
  - [ ] Upload screenshots (5–8)
  - [ ] Add app description, keywords, and category
  - [ ] Add privacy policy and support URLs
  - [ ] Set content rating

- [ ] **Phase 5 (30 min):** Build and test
  - [ ] Build Android bundle: `eas build -p android --profile production`
  - [ ] Upload to internal testing on Play Console
  - [ ] Test on an Android device with the Play Console testing link
  - [ ] Confirm that features work and the app does not crash

- [ ] **Phase 6 (submit):** Submit for review
  - [ ] Review metadata
  - [ ] Submit for App Review
  - [ ] Monitor feedback (typically 24–48 hours)

---

## Phase 1: Android signing setup

### 1.1 Create signing key (if not already done)

```bash
cd apps/mobile
eas build -p android --profile production --local
```

If EAS prompts for a signing key, let EAS generate one. This creates the Android signing credentials.

If you already have a signing keystore:

- Prepare the keystore file
- Record the keystore password and key alias password

### 1.2 Create Google Play service account

1. Open [Google Play Console](https://play.google.com/console)
2. Select your app or create a new app (see Phase 3)
3. Open **Settings → API access → Service Accounts**
4. Select the **Google Cloud Platform** link to open GCP
5. In GCP, create a new service account:
   - Name: `irlobby-play-store`
   - Role: `Editor` (or more restrictive: `Service Account User`)
6. Create and download a JSON key
7. Save the JSON to `apps/mobile/credentials/play-service-account.json`

### 1.3 Update eas.json

The `eas.json` file already contains:

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./credentials/play-service-account.json",
      "track": "internal",
      "releaseStatus": "draft",
      "changesNotSentForReview": false
    }
  }
}
```

Confirm that `serviceAccountKeyPath` points to your JSON file. Change the path if you use a different location.

---

## Phase 2: Generate Android screenshots

Google Play requires phone screenshots at **1080 × 1920 px** (Pixel-class devices).

### Option A: Automated capture (recommended)

1. Start the screenshot web server:

```bash
cd apps/mobile
npm run capture:store-screenshots
```

2. In another terminal:

```bash
node scripts/capture-store-screenshots.mjs android
```

This writes five 1080×1920 PNGs to `store/screenshots-android/`.

### Option B: Manual capture on emulator

1. Start an Android emulator or connect a device
2. Build and run the app:

```bash
cd apps/mobile
npm run android
```

3. Enable screenshot mode (optional, for consistent styling):

```bash
EXPO_PUBLIC_SCREENSHOT_MODE=1 npm run android
```

4. Open each screen:
   - Vibe Quiz scene
   - Discover tab
   - Match celebration
   - Chat screen
   - Profile/Results

5. Capture screenshots at 1080×1920 resolution
6. Save as:
   - `01-vibe-quiz.png`
   - `02-discover-swipe.png`
   - `03-match-celebration.png`
   - `04-chat.png`
   - `05-profile-or-results.png`

7. Place the files in `apps/mobile/store/screenshots-android/`

### Option C: Copy from iOS (if visually identical)

If Android screenshots match iOS visually, resize the iOS PNGs:

```bash
# Resize iOS screenshots to Android dimensions (1080×1920)
cd apps/mobile/store/screenshots-android
for file in ../screenshots/{01,02,03,04,05}*.png; do
  name=$(basename "$file")
  sips -Z 1080 1920 "$file" --out "$name"
done
```

Prefer new Android screenshots when possible.

---

## Phase 3: Create Google Play app entry

1. Open [Google Play Console](https://play.google.com/console)
2. Select **Create app**
3. Enter:
   - **App name:** IRLobby
   - **Default language:** English (US)
   - **App or game:** App
   - **Free or paid:** Free
4. Accept the policies
5. Select **Create**

### 3.1 Verify package name

In the app **Settings → App details**:

- **Package name:** Must be `com.irlobby.app` (from `app.config.ts`)
- If the value differs, align it with `android.package` in `app.config.ts`

---

## Phase 4: Configure store listing

### 4.1 Add app screenshots

1. Open **Store listing → Graphics**
2. Under **Phone screenshots**, select **Add images**
3. Upload all five PNGs from `apps/mobile/store/screenshots-android/`
4. Arrange in this order:
   - 01-vibe-quiz
   - 02-discover-swipe
   - 03-match-celebration
   - 04-chat
   - 05-profile-or-results
5. Save

### 4.2 Add app description

In **Store listing → App details**:

**App name:**

```
IRLobby
```

**Short description** (80 chars max):

```
Tinder for real IRL hangouts
```

**Full description:**

```
IRLobby helps you meet people IRL.

Swipe on activities near you — rooftop hangs, game nights, hikes, or conversations. When another person also swipes right, you match and can chat to make plans.

• 5-question vibe quiz that finds activities that match your energy
• Match celebrations with confetti
• Real-time chat to coordinate
• Host your own events or join others
• Works offline and syncs when you are online again

For users who want real connections.

Download IRLobby and turn swipes into plans.
```

**Categories:** Social (or Social Networking if available)

**Contact info:**

- **Support email:** support@irlobby.com or aaronesbenshade@gmail.com
- **Website:** https://irlobby.com
- **Privacy policy:** https://irlobby.com/privacy

### 4.3 Add graphics and branding

In the **Graphics** section:

- **Feature graphic** (1024×500): Optional; use a marketing image if available
- **Icon** (512×512): Uses the app icon automatically
- **Screenshots:** Added in 4.1

### 4.4 Set age rating

1. Open **Content rating questionnaire**
2. Answer questions about app content:
   - Dialogs/messaging: Yes (chat feature)
   - User-generated content: Yes (activity posts, profile content)
   - Location data: Yes
   - Camera/media access: Yes
3. Submit the questionnaire
4. Google assigns an age rating (typically 12+ or higher)

### 4.5 Privacy and permissions

In **Policies → App permissions**:

- Select permissions the app requests: `CAMERA`, `LOCATION`, `PHOTOS`, `VIBRATE`
- Google verifies these against app code

In **Privacy**:

- Link to privacy policy: https://irlobby.com/privacy
- Select all data types the app collects (see `apps/mobile/store/metadata/privacy-questionnaire.md`)

---

## Phase 5: Build and test

### 5.1 Build Android bundle

```bash
cd apps/mobile
eas build -p android --profile production
```

This creates an App Bundle (`.aab`) for Play Store.

**Duration:** 10–15 minutes

**Monitor:** https://expo.dev/projects/9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe/builds

### 5.2 Upload to internal testing

After the build completes:

1. In Google Play Console, open **Testing → Internal testing**
2. Select **Create new release**
3. Upload the `.aab` file from the EAS build
4. Add release notes: `Initial internal test build`
5. Select **Review release** → **Start rollout to Internal testing**
6. Wait for processing (5–10 min)

### 5.3 Invite testers

1. In **Internal testing**, select **Manage testers**
2. Add your email (or team emails) as internal testers
3. Each tester receives a link to install from Play Store

### 5.4 Smoke test on Android device

Install with the Play Console internal testing link:

1. Open the link on an Android phone or tablet
2. Select **Join the beta testing**
3. Install the app from Play Store
4. Sign in and verify:
   - [ ] App launches without a crash
   - [ ] Onboarding completes
   - [ ] Vibe Quiz works
   - [ ] Discover tab loads
   - [ ] Swipe and match work
   - [ ] Chat works
   - [ ] Profile displays correctly
   - [ ] No crash notifications

If issues appear:

1. Fix code in `apps/mobile/`
2. Commit and push to `main`
3. Trigger a new build: `eas build -p android --profile production`
4. Upload the new `.aab` to internal testing
5. Retest

---

## Phase 6: Submit for review

### 6.1 Final review

In Google Play Console, verify:

- [ ] App name, icon, and description are complete
- [ ] Five screenshots are uploaded
- [ ] Privacy policy is linked
- [ ] Age rating is set
- [ ] Content rating questionnaire is submitted
- [ ] All required permissions are declared

### 6.2 Change release type (optional)

By default, internal testing builds are drafts. To submit for review:

1. Open **Release** → **Production** (or **Beta** for staged rollout)
2. Select **Create new release**
3. Upload the tested `.aab` file
4. Add release notes:

```
First release of IRLobby.

• Meet people through activities
• Vibe-based matching
• Real-time chat
• Host or join events nearby
```

### 6.3 Submit

1. Review all metadata
2. Select **Review release**
3. Check the confirmation checkbox
4. Select **Start rollout to Production** (or **Beta** for phased release)

### 6.4 Monitor review

Google Play typically reviews within **24–48 hours**.

**Approved:**

- The app goes live on Play Store
- The app appears in search results within hours
- You receive an email confirmation

**Rejected:**

- Check feedback in **Release notes**
- Fix issues (often policy violations, crashes, or permission misuse)
- Resubmit
- Typical re-review time: 24 hours

**More information needed:**

- Google may request clarification
- Respond promptly in the notification center

---

## Key resources

| Resource | Link |
|----------|------|
| Google Play Console | https://play.google.com/console |
| GCP Service Accounts | https://console.cloud.google.com/iam-admin/serviceaccounts |
| EAS Dashboard | https://expo.dev/projects/9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe |
| Privacy Policy Template | `apps/mobile/store/metadata/privacy-questionnaire.md` |
| App Config | `apps/mobile/app.config.ts` |
| EAS Config | `apps/mobile/eas.json` |

---

## Common issues

### Build fails with signing error

- Confirm that `serviceAccountKeyPath` in `eas.json` is correct
- Verify that the service account JSON is valid and has Play Store permissions
- Re-run `eas build -p android --profile production`

### Screenshots do not upload

- Verify dimensions: 1080 × 1920 px
- Check file format: PNG (not JPEG)
- Maximum file size: 8 MB each

### App crashes on Android

- Check Sentry: https://sentry.io/organizations/irlobby/issues/
- Confirm `targetSdkVersion: 36` compatibility (enforced since Aug 2026)
- Test on the minimum supported Android version (see `app.config.ts`)

### Review rejected for permission issues

- Request only permissions the app uses
- Use camera, location, and storage only when needed
- Avoid background location requests unless required
- Update the app description to explain why each permission is needed

### Play Store Console blocks submit

- Fill all required store listing fields
- Verify phone number and business address in account settings
- Check for policy violations in the **Policies** tab
- Wait 24 hours if you accepted policies recently

---

## Timeline estimate

| Phase | Time | Blocker |
|-------|------|---------|
| Signing setup | 5 min | Service account JSON |
| Screenshots | 15 min | Device or emulator available |
| App entry | 10 min | None |
| Store listing | 20 min | Writing descriptions |
| Build | 15 min | Network and EAS availability |
| Internal test | 10 min | None |
| Smoke test | 10 min | Android device |
| **Submit** | 5 min | None |
| **Review** | 24–48 hrs | Google review queue |

**Total hands-on:** about 2–3 hours  
**Total calendar:** 2–3 days (including review time)

---

## Success criteria

- [ ] App is visible on Play Store
- [ ] Search for "IRLobby" finds the app
- [ ] Screenshots and description display correctly
- [ ] Download works on a real Android device
- [ ] Core user flows do not crash
- [ ] Privacy policy is accessible from the app

---

For iOS comparison, see `apps/mobile/APP_STORE_RELEASE.md`.
