import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:19008';
const platform = process.argv[2] ?? 'ios'; // 'ios' or 'android'

const outputDir =
  platform === 'android'
    ? new URL('../store/screenshots-android/', import.meta.url)
    : new URL('../store/screenshots/', import.meta.url);

const scenes = [
  ['vibe-quiz', '01-vibe-quiz.png'],
  ['discover-swipe', '02-discover-swipe.png'],
  ['match-celebration', '03-match-celebration.png'],
  ['chat', '04-chat.png'],
  ['profile-or-results', '05-profile-or-results.png'],
];

// iPhone 6.9" = 1320×2868 @ 3x = 440×956 viewport
// Android Pixel 6 = 1080×2340 @ 3x = 360×780 viewport
const viewports = {
  ios: { width: 440, height: 956 },
  android: { width: 360, height: 780 },
};

const viewport = viewports[platform];
if (!viewport) {
  console.error(`Unknown platform: ${platform}. Use 'ios' or 'android'.`);
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

try {
  for (const [scene, fileName] of scenes) {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/?scene=${scene}`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: fileURLToPath(new URL(fileName, outputDir)),
      type: 'png',
    });
    await page.close();
  }
  console.log(`✓ Generated ${platform} screenshots in store/screenshots-${platform}/`);
} finally {
  await context.close();
  await browser.close();
}
