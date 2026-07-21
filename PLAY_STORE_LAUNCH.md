# Google Play Store Launch — IRLobby Android

Complete checklist for publishing IRLobby to Google Play Store.

**Target release:** Week of April 28, 2026  
**Estimated effort:** 2–3 hours  

---

## 📋 Quick Checklist

- [ ] **Phase 1 (5 min):** Android signing setup
  - [ ] Create Google Play signing key (or use existing)
  - [ ] Create Play Store service account JSON
  - [ ] Configure eas.json with service account path

- [ ] **Phase 2 (10 min):** Generate Android screenshots
  - [ ] Capture five 1080×1920 PNG screenshots
  - [ ] Save to `apps/mobile/store/screenshots-android/`

- [ ] **Phase 3 (15 min):** Create Play Store app entry
  - [ ] Create app in Google Play Console
  - [ ] Verify package name: `com.irlobby.app`

- [ ] **Phase 4 (20 min):** Configure store listing
  - [ ] Upload screenshots (5–8)
  - [ ] Add app description, keywords, category
  - [ ] Add privacy policy and support URLs
  - [ ] Set content rating

- [ ] **Phase 5 (30 min):** Build and test
  - [ ] Build Android bundle: `eas build -p android --profile production`
  - [ ] Upload to internal testing on Play Console
  - [ ] Test on Android device via Play Console testing link
  - [ ] Verify no crashes, all features work

- [ ] **Phase 6 (submit):** Submit for review
  - [ ] Final metadata review
  - [ ] Submit for App Review
  - [ ] Monitor for feedback (typically 24–48 hours)

---

## 🔐 Phase 1: Android Signing Setup

### 1.1 Create signing key (if not already done)

```bash
cd apps/mobile
eas build -p android --profile production --local
```

If EAS prompts for a signing key, let it generate one. This will create the necessary Android signing credentials.

Alternatively, if you already have a signing keystore:
- Get the keystore file ready
- Note the keystore password and key alias password

### 1.2 Create Google Play service account

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app or create a new one (see Phase 3)
3. Go to **Settings → API access → Service Accounts**
4. Click the **Google Cloud Platform** link to open GCP
5. In GCP, create a new service account:
   - Name: `irlobby-play-store`
   - Grant role: `Editor` (or more restrictive: `Service Account User`)
6. Create and download a JSON key
7. Save the JSON to `apps/mobile/credentials/play-service-account.json`

### 1.3 Update eas.json

The `eas.json` already has:

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

Ensure the `serviceAccountKeyPath` points to your JSON file (or adjust if using a different location).

---

## 📱 Phase 2: Generate Android Screenshots

Google Play requires screenshots for **phone** at **1080 × 1920 px** (Pixel-class devices).

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

This outputs five 1080×1920 PNGs to `store/screenshots-android/`.

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

4. Navigate each screen:
   - Vibe Quiz scene
   - Discover tab
   - Match celebration
   - Chat screen
   - Profile/Results

5. Capture screenshots (cmd+shift+5 on Mac) at 1080×1920 resolution
6. Save as:
   - `01-vibe-quiz.png`
   - `02-discover-swipe.png`
   - `03-match-celebration.png`
   - `04-chat.png`
   - `05-profile-or-results.png`

7. Place in `apps/mobile/store/screenshots-android/`

### Option C: Copy from iOS (if visually identical)

If the Android screenshots are visually the same as iOS, you can resize the iOS PNGs:

```bash
# Resize iOS screenshots to Android dimensions (1080×1920)
cd apps/mobile/store/screenshots-android
for file in ../screenshots/{01,02,03,04,05}*.png; do
  name=$(basename "$file")
  sips -Z 1080 1920 "$file" --out "$name"
done
```

(This is a workaround; fresh Android screenshots are better.)

---

## 🏪 Phase 3: Create Google Play App Entry

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Enter:
   - **App name:** IRLobby
   - **Default language:** English (US)
   - **App or game:** Select App
   - **Free or paid:** Free
4. Accept the policies
5. Click **Create**

### 3.1 Verify package name

In the app's **Settings → App details**:
- **Package name:** Should be `com.irlobby.app` (from `app.config.ts`)
- If not, ensure this matches your `android.package` in `app.config.ts`

---

## 🎨 Phase 4: Configure Store Listing

### 4.1 Add app screenshots

1. Go to **Store listing → Graphics**
2. Under **Phone screenshots**, click **Add images**
3. Upload all five PNGs from `apps/mobile/store/screenshots-android/`
4. Arrange in order:
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
IRLobby makes it easy to meet people IRL.

Swipe on fun activities happening near you — rooftop hangs, game nights, hikes, or deep conversations. When someone else swipes right too, you instantly match and can chat to actually make plans.

No more endless texting that goes nowhere.

• Fun 5-question vibe quiz that finds activities matching your energy
• Satisfying match celebrations with confetti
• Real-time chat to coordinate
• Host your own events or join others
• Works offline and syncs when you're back online

Perfect for Gen Z & young adults who want real connections instead of more apps.

Download IRLobby and start turning swipes into actual memories.
```

**Categories:** Social (or Social Networking if available)

**Contact info:**
- **Support email:** support@irlobby.com or aaronesbenshade@gmail.com
- **Website:** https://irlobby.com
- **Privacy policy:** https://irlobby.com/privacy

### 4.3 Add graphics & branding

In **Graphics** section:
- **Feature graphic** (1024×500): Optional; use if you have marketing image
- **Icon** (512×512): Will auto-use your app icon
- **Screenshots**: Already added in 4.1

### 4.4 Set age rating

1. Go to **Content rating questionnaire**
2. Answer questions about app content:
   - Dialogs/messaging: Yes (chat feature)
   - User-generated content: Yes (activity posts, profile content)
   - Location data: Yes
   - Camera/media access: Yes
3. Submit questionnaire
4. Google will assign age rating (typically 12+ or higher)

### 4.5 Privacy and permissions

In **Policies → App permissions**:
- Select permissions your app requests: `CAMERA`, `LOCATION`, `PHOTOS`, `VIBRATE`
- Google will verify against app code

In **Privacy**:
- Link to privacy policy: https://irlobby.com/privacy
- Select all data types your app collects (see `apps/mobile/store/metadata/privacy-questionnaire.md`)

---

## 🧪 Phase 5: Build and Test

### 5.1 Build Android bundle

```bash
cd apps/mobile
eas build -p android --profile production
```

This creates an App Bundle (.aab) optimized for Play Store.

**Duration:** 10–15 minutes

**Monitor:** https://expo.dev/projects/9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe/builds

### 5.2 Upload to internal testing

Once build completes:

1. In Google Play Console, go to **Testing → Internal testing**
2. Click **Create new release**
3. Upload the `.aab` file (from EAS build)
4. Add release notes: "Initial internal test build"
5. Click **Review release** → **Start rollout to Internal testing**
6. Wait for processing (5–10 min)

### 5.3 Invite testers

1. In **Internal testing**, click **Manage testers**
2. Add your email (or team emails) as internal testers
3. Each tester will receive a link to install from Play Store

### 5.4 Smoke test on Android device

Install via Play Console internal testing link:
1. Open link on Android phone/tablet
2. Tap "Join the beta testing"
3. Install app from Play Store
4. Sign in and verify:
   - ✓ App launches without crashing
   - ✓ Onboarding completes
   - ✓ Vibe Quiz works
   - ✓ Discover tab loads
   - ✓ Can swipe and match
   - ✓ Chat works
   - ✓ Profile displays correctly
   - ✓ No crash notifications

**If issues found:**
1. Fix code in `apps/mobile/`
2. Commit and push to `main`
3. Trigger new build: `eas build -p android --profile production`
4. Upload new `.aab` to internal testing
5. Retest

---

## 🎯 Phase 6: Submit for Review

### 6.1 Final review

In Google Play Console, verify:
- ✓ App name, icon, description filled in
- ✓ Five screenshots uploaded
- ✓ Privacy policy linked
- ✓ Age rating set
- ✓ Content rating questionnaire submitted
- ✓ All required permissions declared

### 6.2 Change release type (optional)

By default, internal testing builds are drafts. To submit for review:

1. Go to **Release** → **Production** (or **Beta** for staged rollout)
2. Click **Create new release**
3. Upload the tested `.aab` file
4. Add release notes:
```
First release of IRLobby! 🎉

• Meet people through fun activities
• Vibe-based matching
• Real-time chat
• Host or join events nearby
```

### 6.3 Submit

1. Review all metadata one final time
2. Click **Review release**
3. Check "I confirm..." checkbox
4. Click **Start rollout to Production** (or **Beta** for phased)
5. **Submitted!**

### 6.4 Monitor review

Google Play typically reviews within **24–48 hours**:

**✅ Approved:**
- App goes live on Play Store
- Appears in search results within hours
- You'll receive email confirmation

**❌ Rejected:**
- Check feedback in **Release notes**
- Fix issues (usually policy violations, crashes, or permission misuse)
- Resubmit
- Typical re-review time: 24 hours

**⏳ More info needed:**
- Google may request clarification
- Respond promptly in the notification center

---

## 🔗 Key Resources

| Resource | Link |
|----------|------|
| **Google Play Console** | https://play.google.com/console |
| **GCP Service Accounts** | https://console.cloud.google.com/iam-admin/serviceaccounts |
| **EAS Dashboard** | https://expo.dev/projects/9a2fdb59-af3e-4f3f-b6f1-e86d58bdf4fe |
| **Privacy Policy Template** | `apps/mobile/store/metadata/privacy-questionnaire.md` |
| **App Config** | `apps/mobile/app.config.ts` |
| **EAS Config** | `apps/mobile/eas.json` |

---

## ⚠️ Common Issues

### Build fails with signing error
- Ensure `serviceAccountKeyPath` in `eas.json` is correct
- Verify service account JSON is valid and has Play Store permissions
- Re-run `eas build -p android --profile production`

### Screenshots not uploading
- Verify dimensions: 1080 × 1920 px
- Check file format: PNG (not JPEG)
- Maximum file size: 8 MB each

### App crashes on Android
- Check Sentry: https://sentry.io/organizations/irlobby/issues/
- Ensure `targetSdkVersion: 36` compatibility (enforced since Aug 2026)
- Test on minimum supported Android version (check `app.config.ts`)

### Review rejected for permission issues
- Only request permissions you actually use
- Verify camera/location/storage are only used when needed
- Avoid background location requests unless critical
- Update app description to explain why each permission is needed

### Play Store console won't let me submit
- Ensure all required store listing fields are filled
- Verify phone number and business address in account settings
- Check for policy violations in **Policies** tab
- Wait 24 hours if you just accepted policies

---

## Timeline Estimate

| Phase | Time | Blocker |
|-------|------|---------|
| Signing setup | 5 min | Service account JSON |
| Screenshots | 15 min | Device/emulator available |
| App entry | 10 min | None |
| Store listing | 20 min | Writing descriptions |
| Build | 15 min | Network/EAS availability |
| Internal test | 10 min | None |
| Smoke test | 10 min | Android device |
| **Submit** | 5 min | None |
| **Review** | 24–48 hrs | Google's review queue |

**Total hands-on:** ~2–3 hours  
**Total calendar:** 2–3 days (including review time)

---

## Success Criteria

- ✅ App visible on Play Store
- ✅ Can search for "IRLobby" and find it
- ✅ Screenshots and description display correctly
- ✅ Download works on real Android device
- ✅ No crashes during core user flows
- ✅ Privacy policy accessible from app

---

**Questions?** Reference `apps/mobile/APP_STORE_RELEASE.md` for iOS comparison or ask for help debugging specific Play Store console errors.

Good luck! 🚀
