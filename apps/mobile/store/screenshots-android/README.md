# Android App Store Screenshots

Google Play requires screenshots for multiple device types. These are for **Pixel (5.8-inch)** phones at **1080 × 1920 px**.

## Files

Five required screenshots:
1. `01-vibe-quiz.png` — Vibe Quiz onboarding with progress
2. `02-discover-swipe.png` — Discover tab with swipeable activity cards
3. `03-match-celebration.png` — "It's a match!" celebration with confetti
4. `04-chat.png` — Real-time chat interface
5. `05-profile-or-results.png` — Profile or Vibe Quiz Results view

## Generate (automated)

The repo includes a Playwright-based capture script for Android screenshots.

1. Start the screenshot server:
```bash
cd apps/mobile
npm run capture:store-screenshots
```

2. In another terminal, generate Android screenshots:
```bash
node scripts/capture-store-screenshots.mjs android
```

This outputs five 1080×1920 PNGs to this directory.

## Generate (manual)

If you prefer manual capture:
1. Build and run the app on an Android device or emulator
2. Enable `EXPO_PUBLIC_SCREENSHOT_MODE=1` environment variable
3. Navigate each scene and take screenshots at 1080×1920 resolution
4. Save as `01-vibe-quiz.png`, `02-discover-swipe.png`, etc.

## Dimensions

- **Format:** PNG (not JPEG)
- **Resolution:** 1080 × 1920 px
- **Device:** Pixel-class phone (5.8-inch)
- **Count:** 5 minimum required (8 slots available)

## Upload

In Google Play Console:
1. Select app → Store listing
2. Go to "Graphics" → "Phone screenshots"
3. Drag and drop these five PNGs
4. Save

Screenshots appear in this order in the store listing.
