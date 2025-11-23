import { expect } from '@playwright/test';
import { test } from './utils/fixtures';

test.describe('when it has an update available', () => {
  test.use({
    mockData: [{
      updater: {
        available: true,
        availableVersion: '1.2.3',
        currentVersion: '1.2.2',
      },
    }, { scope: 'test' }],
  });

  test('it shows the alert', async ({ page }) => {
    await page.goto('/');
    const updateAlert = page.getByTestId('updater-alert');
    await expect(updateAlert).toBeVisible();
  });

  test('it hides the alert when the update gets ignored', async ({ page }) => {
    await page.goto('/');
    const updateAlert = page.getByTestId('updater-alert');
    await expect(updateAlert).toBeVisible();
    await updateAlert.getByText('Later').click();
    await expect(updateAlert).not.toBeVisible();
  });

  test('it shows the update download progress', async ({ page }) => {
    await page.clock.install({ time: new Date('2025-09-15T21:30:00') });

    await page.goto('/');
    const updateAlert = page.getByTestId('updater-alert');

    await page.clock.pauseAt(new Date('2025-09-15T21:45:00'));
    await updateAlert.getByRole('button', { name: 'Download' }).click();
    await page.clock.runFor(1000);

    await expect(page.getByText('50%')).toBeVisible();

    await page.clock.runFor(1000);

    await expect(page.getByText('100%')).toBeVisible();

    await page.clock.runFor(1000);

    await expect(page.getByRole('button', { name: 'Install' })).toBeVisible();
  });

  test('it installs the update after user confirmation', async ({ page }) => {
    await page.clock.install({ time: new Date('2025-09-15T21:30:00') });

    await page.goto('/');
    const updateAlert = page.getByTestId('updater-alert');

    await page.clock.pauseAt(new Date('2025-09-15T21:45:00'));
    await updateAlert.getByRole('button', { name: 'Download' }).click();
    await page.clock.runFor(3000);
    await page.clock.resume();

    await updateAlert.getByRole('button', { name: 'Install' }).click();
    await expect(updateAlert).not.toBeVisible();
  });
});

test.describe('when it has no update available', () => {
  test('it shows no alert', async ({ page }) => {
    await page.goto('/');
    const updateAlert = page.getByTestId('updater-alert');
    await expect(updateAlert).not.toBeVisible();
  });
});
