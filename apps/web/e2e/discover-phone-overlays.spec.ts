import { expect, test, type Page } from '@playwright/test';

const profile = {
  id: 1,
  email: 'tester@example.com',
  first_name: 'Test',
  last_name: 'User',
  onboarding_completed: true,
  church: { id: 1, name: 'Franconia Mennonite Church' },
};

const activity = {
  id: 42,
  title: "Men's Saturday Breakfast",
  description: 'Fellowship breakfast.',
  location: 'Fellowship Hall, Franconia Mennonite Church',
  time: '2026-10-11T11:30:00Z',
  capacity: 20,
  tags: ['breakfast'],
  images: [],
  participant_count: 0,
};

async function mockDiscover(page: Page, inbox: { matches: unknown; conversations: unknown }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('authToken', 'e2e-access-token');
    window.localStorage.setItem('userId', '1');
  });

  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/users/profile/')) {
      await route.fulfill({ json: profile });
      return;
    }
    if (url.includes('/api/activities')) {
      await route.fulfill({ json: [activity] });
      return;
    }
    if (url.includes('/api/prayers')) {
      await route.fulfill({ json: { items: [] } });
      return;
    }
    if (url.includes('/api/matches/')) {
      await route.fulfill({ json: inbox.matches });
      return;
    }
    if (url.includes('/api/messages/conversations')) {
      await route.fulfill({ json: inbox.conversations });
      return;
    }
    await route.fulfill({ status: 404, json: {} });
  });
}

async function expectPhoneSheet(page: Page, testId: string) {
  const sheet = page.getByTestId(testId);
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
  expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 2);

  const dialog = page.getByRole('dialog');
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  if (!dialogBox) return;
  expect(dialogBox.x).toBeLessThanOrEqual(1);
  expect(dialogBox.width).toBeGreaterThanOrEqual(viewport.width - 2);

  const chrome = await sheet.evaluate((node) => {
    const style = getComputedStyle(node);
    const overlay = node.parentElement?.previousElementSibling;
    return {
      radius: style.borderTopLeftRadius,
      paddingBottom: style.paddingBottom,
      overlay: overlay ? getComputedStyle(overlay).backgroundColor : '',
    };
  });
  expect(chrome.radius).toBe('22px');
  expect(chrome.paddingBottom.endsWith('px')).toBeTruthy();
  expect(Number.parseFloat(chrome.paddingBottom)).toBeGreaterThanOrEqual(24);
  expect(chrome.overlay).toBe('rgba(20, 14, 16, 0.42)');
}

test('phone discover bell survives a paginated inbox and filter stays on screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDiscover(page, {
    matches: {
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 7, activity: "Men's Saturday Breakfast", created_at: 'not-a-date' }],
    },
    conversations: {
      count: 1,
      next: null,
      previous: null,
      results: [
        { id: 2, match: 'Quiet chat', messages: null },
        {
          id: 3,
          match: 'Breakfast chat',
          matchId: 9,
          messages: {
            results: [
              {
                id: 1,
                message: 'See you there',
                createdAt: '2026-10-21T15:00:00Z',
                user: { firstName: 'Ada' },
              },
            ],
          },
        },
      ],
    },
  });

  await page.addInitScript(() => {
    const style = document.createElement('style');
    style.textContent =
      '[role="dialog"]{transform:translateZ(0)!important;-webkit-transform:translateZ(0)!important}';
    document.documentElement.appendChild(style);
  });

  const activityUrls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/activities')) activityUrls.push(request.url());
  });

  await page.goto('/app/discovery');
  await expect(page.getByRole('heading', { name: 'Discover', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Open notifications' }).click();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByText('New message in Breakfast chat')).toBeVisible();
  await expect(page.getByText("You're going to Men's Saturday Breakfast.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Discover' })).toBeVisible();
  await expectPhoneSheet(page, 'discover-notifications-sheet');

  await page.getByRole('button', { name: 'Back to Discover' }).click();
  await expect(page.getByRole('heading', { name: 'Discover', exact: true })).toBeVisible();
  await expect(page.getByTestId('discover-notifications-sheet')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open discovery filters' }).click();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Filter gatherings' })).toBeVisible();
  await expect(page.getByText('Narrow Discover to gatherings that fit you.')).toBeVisible();
  await expect(page.getByPlaceholder('City or church / place')).toBeVisible();
  await expect(page.getByText('Within: 25 miles')).toBeVisible();
  await expect(page.getByText('Price Range')).toHaveCount(0);
  await expect(page.getByText('Skill Level')).toHaveCount(0);
  await expect(page.getByText('Nightlife')).toHaveCount(0);
  await expect(page.getByText('Tags')).toHaveCount(0);
  const apply = page.getByRole('button', { name: 'Apply', exact: true });
  await apply.scrollIntoViewIfNeeded();
  await expect(apply).toBeVisible();
  await expectPhoneSheet(page, 'discover-filter-sheet');
  await apply.click();
  await expect(page.getByTestId('discover-filter-sheet')).toHaveCount(0);
  await expect.poll(() => activityUrls.at(-1) ?? '').toContain('radius=25');
  const applied = new URL(activityUrls.at(-1) ?? 'http://127.0.0.1/api/activities/');
  for (const dropped of [
    'price_min',
    'price_max',
    'skill_level',
    'tags',
    'age_restriction',
    'category',
    'audience',
  ]) {
    expect(applied.searchParams.get(dropped)).toBeNull();
  }
  await expect(page.getByRole('heading', { name: 'Discover', exact: true })).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});

test('phone discover bell shows a calm empty inbox', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDiscover(page, {
    matches: { count: 0, next: null, previous: null, results: [] },
    conversations: { count: 0, next: null, previous: null, results: [] },
  });

  await page.goto('/app/discovery');
  await page.getByRole('button', { name: 'Open notifications' }).click();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('No notifications yet')).toBeVisible();
  await expect(
    page.getByText(
      'When a gathering is confirmed or a chat gets a new message, the update will appear here.',
    ),
  ).toBeVisible();
});

test('desktop filter stays a centered pane', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockDiscover(page, {
    matches: { count: 0, results: [] },
    conversations: { count: 0, results: [] },
  });

  await page.goto('/app/discovery');
  await page.getByRole('button', { name: 'Open discovery filters' }).click();
  const sheet = page.getByTestId('discover-filter-sheet');
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.width).toBeLessThanOrEqual(448);
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(24);
});
