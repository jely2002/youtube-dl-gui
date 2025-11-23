import { expect } from '@playwright/test';
import { test } from './utils/fixtures';

test('it shows the amount of ready videos', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'https://example.com/video1');
  await page.click('button[type="submit"]');
  await page.fill('input[type="text"]', 'https://example.com/video2');
  await page.click('button[type="submit"]');
  await expect(page.getByText('Ready to download! 2 items queued.')).toBeVisible();
});
