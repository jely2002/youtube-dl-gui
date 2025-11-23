import { expect } from '@playwright/test';
import { test } from './utils/fixtures';

test('it persists the selected formats after viewing metadata', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'https://example.com/video');
  await page.click('button[type="submit"]');
  const trackSelect = page.getByLabel('Select track to download');
  await trackSelect.selectOption('audio');
  await page.getByTitle('Show metadata').click();
  await expect(page.getByText('Metadata')).toBeVisible();
  await page.click('a.btn.btn-soft[href=\'/\']');
  await expect(trackSelect).toHaveValue('audio');
});
