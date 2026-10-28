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

test('authenticated user can load discovery', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('authToken', 'e2e-access-token');
    window.localStorage.setItem('userId', '1');
  });

  await page.route('**/api/users/profile/', async (route) => {
    await route.fulfill({ json: profile });
  });

  await page.route('**/api/activities/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes('/whos-coming/') && method === 'GET') {
      await route.fulfill({
        json: {
          me: { name: 'Test', eligible: true },
          dependents: [{ id: 1, name: 'Caleb', age: 10, eligible: true }],
        },
      });
      return;
    }
    if (method === 'GET') {
      await route.fulfill({ json: [activity] });
      return;
    }
    await route.continue();
  });

  await page.goto('/app/discovery');

  await expect(page.getByRole('heading', { name: 'Discover', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upcoming gatherings' })).toHaveCount(0);
  await expect(page.getByText('From Franconia Mennonite Church')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: activity.title, level: 3 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pass', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: "I'm coming", exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Details', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'RSVP', exact: true })).toHaveCount(0);

  await page.getByRole('heading', { name: activity.title, level: 3 }).click();
  const details = page.getByTestId('gathering-details-sheet');
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: 'Close', exact: true }).first().click();
  await expect(details).toHaveCount(0);

  await page.getByRole('button', { name: "I'm coming", exact: true }).click();
  await expect(page.getByRole('heading', { name: "Who's coming?" })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('button', { name: 'Pass', exact: true }).click();
  await expect(page.getByRole('heading', { name: activity.title, level: 3 })).toHaveCount(0);
});
