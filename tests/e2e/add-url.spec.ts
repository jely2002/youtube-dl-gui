import { expect } from '@playwright/test';
import { test } from './utils/fixtures';

test('it can have a new video added', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'https://example.com/video');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Test Video')).toBeVisible();
});
