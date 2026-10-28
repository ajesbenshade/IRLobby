import { expect, test } from '@playwright/test';

const storedPrivacy = {
  profileVisibility: 'friends',
  locationSharing: true,
  showAge: false,
  showEmail: true,
  futureKey: { nested: 1 },
};

const profile = {
  id: 1,
  email: 'tester@example.com',
  first_name: 'Test',
  last_name: 'User',
  onboarding_completed: true,
  preferences: {
    theme: 'light',
    interests: ['hiking'],
    distanceUnit: 'kilometers',
    maxDistance: 40,
    privacy: storedPrivacy,
    notifications: {
      pushNotifications: false,
      emailNotifications: true,
      activityReminders: true,
      newMatches: false,
      messages: true,
    },
  },
};

test('foyer settings keeps notification, feedback, export, and delete rows', async ({ page }) => {
  let patchBody: { preferences?: Record<string, unknown> } | null = null;

  await page.addInitScript(() => {
    window.localStorage.setItem('authToken', 'e2e-access-token');
    window.localStorage.setItem('userId', '1');
  });

  await page.route('**/api/users/profile/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/export/')) {
      await route.fulfill({ json: { exported: true } });
      return;
    }

    if (method === 'PATCH') {
      patchBody = route.request().postDataJSON() as { preferences?: Record<string, unknown> };
      await route.fulfill({
        json: {
          ...profile,
          preferences: patchBody.preferences ?? profile.preferences,
        },
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({ json: profile });
      return;
    }

    await route.fallback();
  });

  await page.goto('/app/settings');

  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('Test User')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Push notifications' })).not.toBeChecked();

  for (const label of ['Email notifications', 'Activity reminders', 'Messages']) {
    await expect(page.getByRole('switch', { name: label })).toBeVisible();
  }

  await expect(page.getByRole('link', { name: 'Send feedback' })).toBeVisible();
  await expect(page.getByText('Email the team at support@irlobby.com')).toBeVisible();
  const href = await page.getByTestId('settings-send-feedback').getAttribute('href');
  expect(href?.startsWith('mailto:support@irlobby.com?subject=The%20Foyer%20beta%20feedback')).toBe(
    true,
  );

  await expect(page.getByRole('button', { name: 'Export my data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete account' })).toBeVisible();

  for (const gone of [
    'Gathering updates',
    'Profile Visibility',
    'Show Location',
    'Show Age',
    'Show Email',
    'Distance Unit',
    'Maximum Distance',
    'Theme',
    'Public',
    'Friends Only',
  ]) {
    await expect(page.getByText(gone, { exact: true })).toHaveCount(0);
  }

  await page.getByRole('switch', { name: 'Messages' }).click();
  await expect.poll(() => patchBody).toBeTruthy();

  const preferences = patchBody?.preferences ?? {};
  const notifications = preferences.notifications as { messages?: boolean; newMatches?: boolean };
  expect(preferences.privacy).toEqual(storedPrivacy);
  expect(preferences.theme).toBe('light');
  expect(preferences.interests).toEqual(['hiking']);
  expect(preferences.distanceUnit).toBe('kilometers');
  expect(preferences.maxDistance).toBe(40);
  expect(notifications.messages).toBe(false);
  expect(notifications.newMatches).toBe(false);

  await page.goto('/app/profile');
  await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reviews' })).toHaveCount(0);
});
