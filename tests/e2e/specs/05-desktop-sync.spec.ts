import { test, expect } from '../fixtures';
import { clearStorageLocal, setStorageLocal } from '../helpers';

test.describe('Journey 5: Desktop App Mirror Authority & Sync', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorageLocal(context);
  });

  test('mirrors desktop focus session, enforces web blocking, and disables popup stop button', async ({
    context,
    popupPage,
    extensionId,
  }) => {
    // 1. Initially popup is ready
    await expect(popupPage.locator('h1')).toContainText(/ready to focus/i);

    // 2. Simulate Desktop App syncing an active focus session
    const desktopSessionId = `service-sync-${Date.now()}`;
    await setStorageLocal(context, {
      active_session: {
        id: desktopSessionId,
        preset_id: null,
        mode: 'blocklist',
        started_at: new Date().toISOString(),
        planned_duration_sec: 1500,
        status: 'active',
        ended_at: null,
        blocklist_snapshot: ['example.com'],
        whitelist_snapshot: [],
        ends_at: new Date(Date.now() + 1500 * 1000).toISOString(),
      },
    });

    // 3. Verify popup updates to show mirrored focus state
    await expect(popupPage.locator('h1')).toContainText(/Focus Mode Active/i);

    // Verify desktop mirror banner is shown
    await expect(
      popupPage.locator('text=Started in the Focus Block app. End it there.')
    ).toBeVisible();

    // Verify "Stop Session" button is NOT displayed (desktop owns stopping)
    await expect(popupPage.locator('button', { hasText: /Stop Session/i })).toHaveCount(0);

    // 4. Verify Chrome blocks navigation to the desktop-specified domain
    const tab = await context.newPage();
    await tab.goto('http://example.com');
    await expect(tab).toHaveURL(new RegExp(`chrome-extension://${extensionId}/blocked/index.html`));
    await expect(tab.locator('h1')).toHaveText('Site Blocked');

    // 5. Simulate Desktop App ending the session
    await setStorageLocal(context, {
      active_session: null,
    });

    // 6. Verify popup returns to ready state
    await expect(popupPage.locator('h1')).toContainText(/ready to focus/i);
    await expect(
      popupPage.locator('text=Started in the Focus Block app. End it there.')
    ).toHaveCount(0);

    // 7. Verify web requests are unblocked
    await tab.goto('http://example.com', { timeout: 10000 }).catch(() => {});
    expect(tab.url()).not.toContain('blocked/index.html');

    await tab.close();
  });
});
