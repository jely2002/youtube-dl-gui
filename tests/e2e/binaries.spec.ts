import { expect } from '@playwright/test';
import { test } from './utils/fixtures';

test.describe('when it has missing binaries', () => {
  test.use({
    mockData: [{
      binaries: {
        check: ['yt-dlp'],
        ensure: true,
      },
    }, { scope: 'test' }],
  });

  test('it shows progress when installing the binary', async ({ page }) => {
    await page.clock.install({ time: new Date('2025-09-15T21:30:00') });
    await page.clock.pauseAt(new Date('2025-09-15T21:45:00'));

    await page.goto('/');

    await expect(page.getByText('We\'re getting everything ready.')).toBeVisible();
    await page.clock.runFor(1000);

    await expect(page.getByText('1.2.3')).toBeVisible();
    await expect(page.getByText('50%')).toBeVisible();
    await expect(page.getByText('Please wait')).toHaveAttribute('disabled', 'true');
    await page.clock.runFor(1000);

    await expect(page.getByText('100%')).not.toBeVisible();
    await page.clock.runFor(1000);

    const continueButton = page.getByText('Continue');
    await expect(continueButton).not.toHaveAttribute('disabled');
    await continueButton.click();
    await page.clock.resume();

    await expect(page).toHaveURL('/');
  });
});
