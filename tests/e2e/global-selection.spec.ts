import { expect } from '@playwright/test';
import { test } from './utils/fixtures';

test('it uses global track and format options for new items', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'https://example.com/video1');
  await page.click('button[type="submit"]');

  const trackSelect = page.getByLabel('Select track for all videos');
  await expect(trackSelect).toHaveValue('both');
  const formatSelect = page.getByLabel('Select format for all videos');
  await expect(formatSelect).toHaveValue('');

  await trackSelect.selectOption('video');
  await formatSelect.selectOption({ label: '720p30' });

  await page.fill('input[type="text"]', 'https://example.com/video1');
  await page.click('button[type="submit"]');

  const cardTrack = page.locator('select[id$="-track"]').nth(1);
  const cardFormat = page.locator('select[id$="-format"]').nth(1);

  await expect(cardTrack).toHaveValue('video');
  await expect(cardFormat).toHaveValue('id=f720|h=720|fps=30|asr=');
});
