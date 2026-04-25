# Screenshots

Apple requires screenshots for the **iPhone 6.9-inch** display (1320 × 2868 portrait) as the primary set.

## Required shots (in this order)

1. `01-vibe-quiz.png` — Vibe Quiz card with progress bar
2. `02-discover-swipe.png` — Discover screen with an activity card mid-swipe
3. `03-match-celebration.png` — "It's a match!" with confetti
4. `04-chat.png` — Real-time chat with activity context
5. `05-profile-or-results.png` — Profile or VibeQuizResults

## Capture flow (automated)

The repo includes a deterministic screenshot studio and capture script for the five required App Store images.

1. Start the screenshot server:

```bash
cd apps/mobile
npm run capture:store-screenshots
```

2. In a second terminal, generate the PNGs:

```bash
cd apps/mobile
node scripts/capture-store-screenshots.mjs
```

This writes the five required files directly into `store/screenshots/` at 1320 × 2868.

## Capture flow (iOS Simulator)

```bash
cd apps/mobile
npx expo start --ios
# In simulator: Cmd+S to save screenshot, or Device > Trigger Screenshot
```

Use **iPhone 16 Pro Max** simulator for native 6.9" output.

## Optional: 30-second preview video

Capture with simulator (`xcrun simctl io booted recordVideo preview.mov`) then trim to ≤ 30s.
Show: Vibe quiz → Swipe → Match → Chat. No voiceover; text overlays optional.

## Validation

- Portrait only.
- 1320 × 2868 (or per-device equivalent).
- Show **actual app UI** — Apple rejects mocked marketing graphics.
- Strip status bar clutter (use `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`).
