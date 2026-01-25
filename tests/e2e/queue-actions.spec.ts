import { expect, Page } from '@playwright/test';
import { test } from './utils/fixtures';

async function addUrl(page: Page, url: string) {
  await page.fill('input[type="text"]', url);
  await page.click('button[type="submit"]');
}

async function openQueueMenu(page: Page) {
  await page.getByLabel('More queue actions').click();
}

test('it clears queue groups by status', async ({ page }) => {
  await page.goto('/');

  await addUrl(page, 'https://example.com/video-clear-1');
  await addUrl(page, 'https://example.com/video-clear-2');
  await addUrl(page, 'https://example.com/video-clear-3');
  await addUrl(page, 'https://example.com/video-clear-4');

  const cards = page.locator('article.card');
  await expect(cards).toHaveCount(4);

  const [doneId, errorId, downloadingId] = await page.evaluate(async () => {
    // @ts-ignore
    const { useMediaGroupStore } = await import('/src/stores/media/group.ts');
    const groupStore = useMediaGroupStore();
    return Object.keys(groupStore.groups);
  });

  await page.evaluate(async ({ doneId, errorId, downloadingId }) => {
    // @ts-ignore
    const { useMediaStateStore, MediaState } = await import('/src/stores/media/state.ts');
    const stateStore = useMediaStateStore();
    if (doneId) stateStore.setGroupState(doneId, MediaState.done);
    if (errorId) stateStore.setGroupState(errorId, MediaState.error);
    if (downloadingId) stateStore.setGroupState(downloadingId, MediaState.downloading);
  }, { doneId, errorId, downloadingId });

  await openQueueMenu(page);
  await page.getByRole('button', { name: 'Clear successful' }).click();
  await expect(cards).toHaveCount(3);

  await openQueueMenu(page);
  await expect(page.getByRole('button', { name: 'Clear successful' })).toBeDisabled();
  await page.getByRole('button', { name: 'Clear errored' }).click();
  await expect(cards).toHaveCount(2);

  await openQueueMenu(page);
  await expect(page.getByRole('button', { name: 'Clear errored' })).toBeDisabled();
  await page.getByRole('button', { name: 'Clear pending' }).click();
  await expect(cards).toHaveCount(1);

  await openQueueMenu(page);
  await expect(page.getByRole('button', { name: 'Clear pending' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel downloading' }).click();
  await expect(cards).toHaveCount(0);

  await expect(page.getByLabel('More queue actions')).toBeDisabled();
});
