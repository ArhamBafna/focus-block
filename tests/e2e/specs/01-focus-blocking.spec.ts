import { test, expect } from '../fixtures';
import { clearStorageLocal } from '../helpers';

test.describe('Journey 1: Focus Session & Real Web Blocking', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorageLocal(context);
  });

  test('blocks websites during focus session and unblocks when session stops', async ({
    context,
    popupPage,
    extensionId,
  }) => {
    // 1. Initial State: popup is ready
    await expect(popupPage.locator('h1')).toContainText(/ready to focus/i);

    // 2. Navigate to Blocklists page
    const blockNav = popupPage.locator('a[title="Block"]');
    await blockNav.click();
    await expect(popupPage.locator('h1')).toContainText(/Blocklist/i);

    // 3. Add "example.com" to blocklist
    const domainInput = popupPage.locator('input[placeholder*="youtube.com"]');
    await domainInput.fill('example.com');
    await popupPage.locator('button', { hasText: 'Add' }).click();

    // Verify it appears in the list
    await expect(popupPage.locator('text=example.com')).toBeVisible();

    // 4. Return to Focus (Home) page
    const focusNav = popupPage.locator('a[title="Focus"]');
    await focusNav.click();
    await expect(popupPage.locator('h1')).toContainText(/ready to focus/i);

    // 5. Start Focus Session
    const focusBtn = popupPage.locator('button', { hasText: /^focus$/i });
    await focusBtn.click();

    // Verify duration input appears (default 25 minutes) and click Start
    const startBtn = popupPage.locator('button', { hasText: /^Start$/i });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // 6. Verify Focus Mode is active
    await expect(popupPage.locator('h1')).toContainText(/Focus Mode Active/i);
    await expect(popupPage.locator('text=1 site blocked')).toBeVisible();

    // 7. Open a new tab and navigate to the blocked website
    const tab = await context.newPage();
    await tab.goto('http://example.com');

    // 8. Assert that the request was intercepted and redirected to the blocked page
    await expect(tab).toHaveURL(new RegExp(`chrome-extension://${extensionId}/blocked/index.html`));
    await expect(tab.locator('h1')).toHaveText('Site Blocked');
    await expect(tab.locator('#blocked-domain')).toContainText('example.com');

    // 9. Return to popup and click Stop Session
    const stopBtn = popupPage.locator('button', { hasText: /Stop Session/i });
    await expect(stopBtn).toBeVisible();
    await stopBtn.click();

    // Verify session stopped
    await expect(popupPage.locator('h1')).toContainText(/ready to focus/i);

    // 10. Re-navigate to example.com in the tab — verify it is NO LONGER redirected to the blocked page
    await tab.goto('http://example.com', { timeout: 10000 }).catch(() => {});
    expect(tab.url()).not.toContain(extensionId);
    expect(tab.url()).not.toContain('blocked/index.html');
    await expect(tab.locator('#blocked-domain')).toHaveCount(0);

    await tab.close();
  });
});
