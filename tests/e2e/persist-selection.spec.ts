import { expect } from '@playwright/test';
import { test } from './utils/fixtures';

test('it persists the selected formats after viewing metadata', async ({ page }) => {
  await page.goto('/');
  await page.fill('input[type="text"]', 'https://example.com/video');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const trackSelect = page.getByLabel('Select track to download');
  await trackSelect.selectOption('audio');
  await page.getByTitle('Show metadata').click();
  await expect(page.getByText('Metadata')).toBeVisible();
  await page.goBack();
  await expect(trackSelect).toHaveValue('audio');
});
