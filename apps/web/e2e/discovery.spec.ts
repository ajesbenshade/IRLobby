import { expect, test } from '@playwright/test';

const profile = {
  id: 1,
  email: 'tester@example.com',
  first_name: 'Test',
  last_name: 'User',
  onboarding_completed: true,
};

const activity = {
  id: 42,
  host: 'Host User',
  is_approved: true,
  title: 'Rooftop Board Games',
  description: 'A compact but real discovery card for the core journey.',
  category: 'social',
  location: 'Downtown',
  latitude: 40.7128,
  longitude: -74.006,
  time: '2030-05-01T19:00:00Z',
  dateTime: '2030-05-01T19:00:00Z',
  capacity: 8,
  maxParticipants: 8,
  tags: ['board games'],
  images: [],
  created_at: '2030-04-01T12:00:00Z',
  participant_count: 2,
};

test('authenticated user can load discovery and swipe an activity', async ({ page }) => {
  let swipeRequestSeen = false;

  await page.addInitScript(() => {
    window.localStorage.setItem('authToken', 'e2e-access-token');
    window.localStorage.setItem('userId', '1');
  });

  await page.route('**/api/users/profile/', async (route) => {
    await route.fulfill({ json: profile });
  });

  await page.route('**/api/activities/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [activity] });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/swipes/42/swipe/', async (route) => {
    swipeRequestSeen = true;
    await route.fulfill({
      status: 201,
      json: { message: 'Swipe recorded successfully', matched: false },
    });
  });

  await page.goto('/app/discovery');

  await expect(page.getByRole('heading', { name: 'Discover', exact: true })).toBeVisible();
  await expect(page.getByText(activity.title)).toBeVisible();

  await page.getByLabel("I'm going to this activity").click();

  await expect.poll(() => swipeRequestSeen).toBe(true);
  await expect(page.getByText('You cleared the deck')).toBeVisible();
});
