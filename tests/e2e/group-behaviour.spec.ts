import { expect, Page } from '@playwright/test';
import { test } from './utils/fixtures';

async function addPlaylistAndApply(page: Page, url: string) {
  await page.goto('/');
  await page.fill('input[type="text"]', url);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Download all items' }).click();
}

test('it splits small playlists into multiple groups', async ({ page }) => {
  await addPlaylistAndApply(page, 'https://example.com/playlist-small');
  const cards = page.locator('article.card');
  await expect(cards).toHaveCount(2);
  await expect(page.getByText('Playlist')).toHaveCount(0);
});

test('it consolidates large playlists into a single group', async ({ page }) => {
  await addPlaylistAndApply(page, 'https://example.com/playlist-large');
  const cards = page.locator('article.card');
  await expect(cards).toHaveCount(1);
  await expect(page.getByText('Playlist')).toBeVisible();
});
