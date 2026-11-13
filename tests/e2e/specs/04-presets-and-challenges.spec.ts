import { test, expect } from '../fixtures';
import { clearStorageLocal, setStorageLocal } from '../helpers';

test.describe('Journey 4: Presets, Settings & Stop Challenges', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorageLocal(context);
  });

  test('configures stop challenge in settings, requires challenge on session stop, and handles cancellation', async ({
    popupPage,
  }) => {
    // 1. Navigate to Settings page
    const settingsNav = popupPage.locator('a[title="Settings"]');
    await settingsNav.click();
    await expect(popupPage.locator('h1')).toContainText(/Settings/i);

    // 2. Configure stop challenge: select "Countdown Timer"
    const challengeSelect = popupPage.locator('select').first();
    await challengeSelect.selectOption('countdown');
    await popupPage.waitForTimeout(500);

    // 3. Return to Focus page and start a lockdown session (lockdown challenges are enabled by default)
    const focusNav = popupPage.locator('a[title="Focus"]');
    await focusNav.click();
    await popupPage.locator('button', { hasText: /lockdown/i }).click();
    await popupPage.locator('button', { hasText: /^Start$/i }).click();
    await expect(popupPage.locator('h1')).toContainText(/Lockdown Mode Active/i);

    // 4. Click Stop Session -> ChallengeGate should appear!
    const stopBtn = popupPage.locator('button', { hasText: /Stop Session/i });
    await stopBtn.click();

    // Verify Stop Session Challenge heading appears
    await expect(popupPage.locator('h2')).toContainText(/Stop Session Challenge/i);

    // 5. Test Cancel & Resume Focus
    const cancelChallengeBtn = popupPage.locator('button', { hasText: /Cancel & Resume Focus/i });
    await expect(cancelChallengeBtn).toBeVisible();
    await cancelChallengeBtn.click();

    // Confirm lockdown session is still active
    await expect(popupPage.locator('h1')).toContainText(/Lockdown Mode Active/i);
  });

  test('manages blocklist additions, wildcards, and deletions', async ({ popupPage }) => {
    // 1. Navigate to Blocklist
    await popupPage.locator('a[title="Block"]').click();

    // 2. Add an exact domain
    const input = popupPage.locator('input[placeholder*="youtube.com"]');
    await input.fill('reddit.com');
    await popupPage.locator('button', { hasText: 'Add' }).click();
    await expect(popupPage.locator('text=reddit.com')).toBeVisible();

    // 3. Add a wildcard domain
    await input.fill('*distraction');
    await popupPage.locator('button', { hasText: 'Add' }).click();
    await expect(popupPage.locator('text=*distraction')).toBeVisible();

    // 4. Delete reddit.com
    const redditRow = popupPage.locator('div:has-text("reddit.com")').last();
    const trashBtn = redditRow.locator('button').first();
    await trashBtn.click();

    // Confirm reddit.com is removed while *distraction remains
    await expect(popupPage.locator('text=reddit.com')).toHaveCount(0);
    await expect(popupPage.locator('text=*distraction')).toBeVisible();
  });
});
