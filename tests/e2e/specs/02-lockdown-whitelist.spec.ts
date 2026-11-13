import { test, expect } from '../fixtures';
import { clearStorageLocal } from '../helpers';

test.describe('Journey 2: Lockdown (Whitelist / Allowed Sites Only) Mode', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorageLocal(context);
  });

  test('blocks non-whitelisted websites in lockdown mode while allowing whitelisted ones', async ({
    context,
    popupPage,
    extensionId,
  }) => {
    // 1. Navigate to Allow page
    const allowNav = popupPage.locator('a[title="Allow"]');
    await allowNav.click();

    // 2. Add "example.com" to the whitelist
    const allowInput = popupPage.getByLabel('Site to allow');
    await allowInput.fill('example.com');
    await popupPage.locator('button', { hasText: 'Add' }).first().click();

    // Confirm example.com is in whitelist
    await expect(popupPage.locator('text=example.com')).toBeVisible();

    // 3. Return to Focus page
    const focusNav = popupPage.locator('a[title="Focus"]');
    await focusNav.click();

    // 4. Click the "lockdown" button
    const lockdownBtn = popupPage.locator('button', { hasText: /lockdown/i });
    await expect(lockdownBtn).toBeVisible();
    await lockdownBtn.click();

    // Click "Start"
    const startBtn = popupPage.locator('button', { hasText: /^Start$/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // 5. Verify Lockdown Mode is active
    await expect(popupPage.locator('h1')).toContainText(/Lockdown Mode Active/i);

    // 6. Test that non-whitelisted site is blocked
    const tab = await context.newPage();
    await tab.goto('http://neverssl.com');

    // Should redirect to blocked page
    await expect(tab).toHaveURL(new RegExp(`chrome-extension://${extensionId}/blocked/index.html`));
    await expect(tab.locator('h1')).toHaveText('Site Blocked');

    // 7. Test that whitelisted site is allowed
    await tab.goto('http://example.com', { timeout: 10000 }).catch(() => {});
    expect(tab.url()).not.toContain('blocked/index.html');
    await expect(tab.locator('#blocked-domain')).toHaveCount(0);

    // 8. Stop the lockdown session
    const stopBtn = popupPage.locator('button', { hasText: /Stop Session/i });
    await stopBtn.click();
    await expect(popupPage.locator('h1')).toContainText(/ready to focus/i);

    await tab.close();
  });
});
