import { expect, test } from '@playwright/test';
import { visitStoryById } from './helpers';

test.describe('FocusScope container entry', () => {
  test.beforeEach(async ({ page }) => {
    await visitStoryById(page, 'utilities-focus-scope--container-entry');
  });

  for (const loop of [false, true]) {
    for (const trapped of [false, true]) {
      test(`initial container reverse entry with loop=${loop}, trapped=${trapped}`, async ({
        page,
      }) => {
        await page.getByLabel('Loop', { exact: true }).setChecked(loop);
        await page.getByLabel('Trapped', { exact: true }).setChecked(trapped);
        const opener = page.getByRole('button', { name: 'Open scope', exact: true });
        await opener.click();
        const scope = page.getByTestId('outer-scope');
        await expect(scope).toBeFocused();

        await page.keyboard.press('Shift+Tab');
        if (loop) {
          await expect(page.getByRole('button', { name: 'Last', exact: true })).toBeFocused();
          await page.keyboard.press('Tab');
          await expect(page.getByRole('button', { name: 'First', exact: true })).toBeFocused();
        } else if (trapped) {
          await expect(scope).toBeFocused();
          await page.keyboard.press('Tab');
          await expect(page.getByRole('button', { name: 'First', exact: true })).toBeFocused();
          await page.keyboard.press('Shift+Tab');
          await expect(page.getByRole('button', { name: 'First', exact: true })).toBeFocused();
        } else {
          await expect(opener).toBeFocused();
        }
      });
    }
  }

  test('forward entry from the initial container remains native', async ({ page }) => {
    await page.getByRole('button', { name: 'Open scope', exact: true }).click();
    await expect(page.getByTestId('outer-scope')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'First', exact: true })).toBeFocused();
  });

  test('reverse entry skips disabled and hidden edge candidates', async ({ page }) => {
    await page.getByLabel('Disabled edges', { exact: true }).check();
    await page.getByRole('button', { name: 'Open scope', exact: true }).click();
    await expect(page.getByTestId('outer-scope')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Last', exact: true })).toBeFocused();
  });

  test('all-disabled scope retains focus in both directions', async ({ page }) => {
    await page.getByLabel('Empty', { exact: true }).check();
    await page.getByRole('button', { name: 'Open scope', exact: true }).click();
    const scope = page.getByTestId('outer-scope');
    await expect(scope).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(scope).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(scope).toBeFocused();
  });

  test('explicit first focus and normal edge looping are preserved', async ({ page }) => {
    await page.getByLabel('Focus first', { exact: true }).check();
    await page.getByRole('button', { name: 'Open scope', exact: true }).click();
    await expect(page.getByRole('button', { name: 'First', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('button', { name: 'Last', exact: true })).toBeFocused();
  });

  test('nested scope pauses the parent and restores focus before parent re-entry', async ({
    page,
  }) => {
    const opener = page.getByRole('button', { name: 'Open scope', exact: true });
    await opener.click();
    const nestedOpener = page.getByRole('button', { name: 'Open nested', exact: true });
    await nestedOpener.click();
    await expect(page.getByTestId('inner-scope')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    const innerLast = page.getByRole('button', { name: 'Inner last', exact: true });
    await expect(innerLast).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Inner first', exact: true })).toBeFocused();
    await innerLast.click();
    await expect(page.getByTestId('inner-scope')).toHaveCount(0);
    await expect(nestedOpener).toBeFocused();
    await page.getByTestId('outer-scope').focus();
    await page.keyboard.press('Shift+Tab');
    const last = page.getByRole('button', { name: 'Last', exact: true });
    await expect(last).toBeFocused();
    await last.click();
    await expect(page.getByTestId('outer-scope')).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});
