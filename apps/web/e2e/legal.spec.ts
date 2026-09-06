import { expect, test } from '@playwright/test';

test('privacy policy is a real public page with contact details', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
  await expect(page.getByText('support@irlobby.com').first()).toBeVisible();
  await expect(page.getByText(/location while it is in use/i)).toBeVisible();
  await expect(page.getByText(/chat messages/i)).toBeVisible();
});

test('support page is a real public page with contact details', async ({ page }) => {
  await page.goto('/support');
  await expect(page.getByText(/read every message/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'support@irlobby.com' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
});
