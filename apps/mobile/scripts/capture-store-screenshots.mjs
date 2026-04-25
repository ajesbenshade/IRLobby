import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:19008';
const outputDir = new URL('../store/screenshots/', import.meta.url);

const scenes = [
  ['vibe-quiz', '01-vibe-quiz.png'],
  ['discover-swipe', '02-discover-swipe.png'],
  ['match-celebration', '03-match-celebration.png'],
  ['chat', '04-chat.png'],
  ['profile-or-results', '05-profile-or-results.png'],
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 440, height: 956 },
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
} finally {
  await context.close();
  await browser.close();
}
