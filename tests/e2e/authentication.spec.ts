import { expect, Locator, Page } from '@playwright/test';
import { test } from './utils/fixtures';

const getAuthDetails = async (page: Page, clickToOpen = true): Promise<Locator> => {
  await page.goto('/authentication');
  const authDetails = page.getByTestId('auth-details');
  await expect(authDetails).toBeVisible();
  if (clickToOpen) {
    await authDetails.click();
  }

  return authDetails;
};

test.describe('when authentication is not initialized', () => {
  test('it can be initialized', async ({ page }) => {
    await getAuthDetails(page);
    const initAlert = page.getByTestId('auth-init-alert');
    await expect(initAlert.getByRole('button', { name: 'Enable' })).toBeVisible();
    await initAlert.getByRole('button', { name: 'Enable' }).click();
    await expect(initAlert).not.toBeVisible();
  });
});

test.describe('when it has an initialization failure', () => {
  const errorText = 'Failed to initialize';

  test.use({
    mockData: [{
      stronghold: {
        status: {
          unlocked: false,
          initError: errorText,
        },
      },
    }, { scope: 'test' }],
  });
  test('it shows the initialization error with a retry', async ({ page }) => {
    await getAuthDetails(page);
    const initAlert = page.getByTestId('auth-init-alert');
    await expect(initAlert).toBeVisible();
    await expect(initAlert.getByText(errorText)).toBeVisible();
    await expect(initAlert.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});

test.describe('when authentication is initialized', () => {
  const headersValue = 'TEST:1';

  test.use({
    mockData: [{
      stronghold: {
        fields: {
          'auth.headers': headersValue,
        },
        status: {
          unlocked: true,
          initError: undefined,
        },
      },
    }, { scope: 'test' }],
  });
  test('it opens the advanced section when a value exists', async ({ page }) => {
    const authDetails = await getAuthDetails(page, false);
    await expect(authDetails).toHaveAttribute('open');
  });
  test('it enables the save button upon changes', async ({ page }) => {
    const authDetails = await getAuthDetails(page, false);
    const bearerInput = authDetails.getByRole('textbox', { name: 'Token' });
    await bearerInput.fill('test2');
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
  });
  test('it allows cookies to be imported from a browser', async ({ page }) => {
    await getAuthDetails(page, false);
    const browserInput = page.getByRole('combobox', { name: 'Browser' });
    await browserInput.selectOption('Firefox');
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    // After saving, there should be no more changes.
    await expect(saveButton).toBeDisabled();
  });
  test('it allows authentication secrets to be managed', async ({ page }) => {
    const authDetails = await getAuthDetails(page, false);
    const headerInput = authDetails.getByRole('textbox', { name: 'Headers' });
    await expect(headerInput).toHaveValue(headersValue);
    const bearerInput = authDetails.getByRole('textbox', { name: 'Token' });
    const testValue = 'test2';
    await bearerInput.fill(testValue);
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    // Verify keyboard accessibility of BaseSecretInput
    await expect(bearerInput).toHaveAttribute('type', 'password');
    // Reveal the value
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(bearerInput).toHaveAttribute('type', 'text');
    // Clear the value
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    // This should revert the change and disable the save button.
    await expect(bearerInput).not.toHaveValue(testValue);
    await expect(saveButton).toBeDisabled();
    await bearerInput.fill(testValue);
    await saveButton.click();
    // After saving, there should be no more changes.
    await expect(saveButton).toBeDisabled();
  });
});
