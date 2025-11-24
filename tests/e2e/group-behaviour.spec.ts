import { expect } from '@playwright/test';
import { test } from './utils/fixtures';

test('it splits small playlists into multiple groups', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'https://example.com/playlist-small');
  await page.click('button[type="submit"]');
  const cards = page.locator('article.card');
  await expect(cards).toHaveCount(2);
  await expect(page.getByText('Playlist')).toHaveCount(0);
});

test('it consolidates large playlists into a single group', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'https://example.com/playlist-large');
  await page.click('button[type="submit"]');
  const cards = page.locator('article.card');
  await expect(cards).toHaveCount(1);
  await expect(page.getByText('Playlist')).toBeVisible();
});
