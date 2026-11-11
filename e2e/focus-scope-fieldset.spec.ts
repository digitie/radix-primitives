import { expect, test } from '@playwright/test';
import { visitStoryById } from './helpers';

test.describe('FocusScope disabled fieldsets', () => {
  test.beforeEach(async ({ page }) => {
    await visitStoryById(page, 'utilities-focusscope--fieldset-entry');
  });

  for (const start of ['container', 'first']) {
    test(`inherited disabled edge from ${start}`, async ({ page }) => {
      await page.getByRole('button', { name: 'Open fieldset scope', exact: true }).click();
      const scope = page.getByTestId('fieldset-scope');
      await expect(scope).toBeFocused();
      if (start === 'first')
        await page.getByRole('button', { name: 'First active', exact: true }).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('button', { name: 'Last active', exact: true })).toBeFocused();
      await expect(page.getByLabel('Group control', { exact: true })).toBeDisabled();
    });
  }

  test('first legend stays enabled while explicit and inherited controls stay disabled', async ({
    page,
  }) => {
    await page.getByLabel('Legend control', { exact: true }).check();
    await page.getByRole('button', { name: 'Open fieldset scope', exact: true }).click();
    await page.keyboard.press('Shift+Tab');
    const legend = page.getByLabel('Legend active', { exact: true });
    await expect(legend).toBeEnabled();
    await expect(legend).toBeFocused();
    await expect(page.getByLabel('Legend explicitly disabled', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Group control', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'First active', exact: true }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(legend).toBeFocused();
  });

  for (const start of ['container', 'first']) {
    test(`fieldset enable and disable recompute the edge from ${start}`, async ({ page }) => {
      await page.getByRole('button', { name: 'Open fieldset scope', exact: true }).click();
      const target =
        start === 'container'
          ? page.getByTestId('fieldset-scope')
          : page.getByRole('button', { name: 'First active', exact: true });
      await target.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('button', { name: 'Last active', exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Enable fieldset', exact: true }).click();
      await target.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByLabel('Group control', { exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Disable fieldset', exact: true }).click();
      await target.focus();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('button', { name: 'Last active', exact: true })).toBeFocused();
    });
  }

  test('an outer disabled fieldset still disables a nested fieldset legend', async ({ page }) => {
    await page.getByLabel('Legend control', { exact: true }).check();
    await page.getByLabel('Nested fieldset', { exact: true }).check();
    await page.getByRole('button', { name: 'Open fieldset scope', exact: true }).click();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByLabel('Legend active', { exact: true })).toBeFocused();
    // Playwright's nearest-fieldset matcher misses this outer disabled ancestor.
    // Assert the browser's native state and rejected focus, not a weaker helper result.
    const innerLegend = page.getByLabel('Inner legend control', { exact: true });
    expect(await innerLegend.evaluate((element) => element.matches(':disabled'))).toBe(true);
    await innerLegend.evaluate((element) => (element as HTMLInputElement).focus());
    await expect(page.getByLabel('Legend active', { exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Enable fieldset', exact: true }).click();
    await page.getByTestId('fieldset-scope').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByLabel('Inner legend control', { exact: true })).toBeEnabled();
    await expect(page.getByLabel('Inner legend control', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Inner disabled control', { exact: true })).toBeDisabled();
  });

  test('links inside disabled fieldsets remain tabbable', async ({ page }) => {
    await page.getByLabel('Link control', { exact: true }).check();
    await page.getByRole('button', { name: 'Open fieldset scope', exact: true }).click();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('link', { name: 'Enabled link', exact: true })).toBeFocused();
  });

  test('IME composition does not intercept a container Tab before normal reverse entry', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Open fieldset scope', exact: true }).click();
    const scope = page.getByTestId('fieldset-scope');
    const notCancelled = await scope.evaluate((element) =>
      element.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(notCancelled).toBe(true);
    await expect(scope).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Last active', exact: true })).toBeFocused();
  });
});
