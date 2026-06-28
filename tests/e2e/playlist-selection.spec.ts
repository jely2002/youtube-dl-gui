import { expect, Page } from '@playwright/test';
import { test } from './utils/fixtures';

async function openPlaylistSelection(page: Page) {
  await page.goto('/');
  await page.fill('input[type="text"]', 'https://example.com/playlist-small');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download all items' })).toBeVisible();
}

test('it applies a simple playlist range selection', async ({ page }) => {
  await openPlaylistSelection(page);

  await page.locator('#playlist-selection-start').fill('1');
  await page.locator('#playlist-selection-end').fill('1');
  await expect(page.getByText(/1 of 2 item/)).toBeVisible();

  await page.getByRole('button', { name: 'Download selected items' }).click();

  const cards = page.locator('article.card');
  await expect(cards).toHaveCount(1);
  await expect(page.getByText('Item 1')).toBeVisible();
});

test('it applies an advanced playlist selection', async ({ page }) => {
  await openPlaylistSelection(page);

  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.locator('input[id^="playlist-row-index-"]').fill('2');
  await page.getByRole('button', { name: 'Use advanced selection' }).click();

  await expect(page.getByText('Advanced:')).toBeVisible();
  await expect(page.locator('code')).toContainText('2');
  await expect(page.getByText(/1 of 2 item/)).toBeVisible();

  await page.getByRole('button', { name: 'Download selected items' }).click();

  const cards = page.locator('article.card');
  await expect(cards).toHaveCount(1);
  await expect(page.getByText('Item 2')).toBeVisible();
});
