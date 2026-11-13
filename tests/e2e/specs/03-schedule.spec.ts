import { test, expect } from '../fixtures';
import { clearStorageLocal } from '../helpers';

function formatHHMM(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

test.describe('Journey 3: Scheduled Focus Windows', () => {
  test.beforeEach(async ({ context }) => {
    await clearStorageLocal(context);
  });

  test('creates a schedule covering now, activates blocking automatically, and releases on delete', async ({
    context,
    popupPage,
    extensionId,
  }) => {
    // 1. Add "example.com" to blocklist first
    await popupPage.locator('a[title="Block"]').click();
    const domainInput = popupPage.locator('input[placeholder*="youtube.com"]');
    await domainInput.fill('example.com');
    await popupPage.locator('button', { hasText: 'Add' }).click();
    await expect(popupPage.locator('text=example.com')).toBeVisible();

    // 2. Navigate to Schedule page
    const scheduleNav = popupPage.locator('a[title="Schedule"]');
    await scheduleNav.click();
    await expect(popupPage.locator('h1')).toContainText(/Schedule/i);

    // 3. Configure schedule window: start 10 min ago, end 50 min in future
    const now = new Date();
    const past = new Date(now.getTime() - 10 * 60 * 1000);
    const future = new Date(now.getTime() + 50 * 60 * 1000);

    const startTimeStr = formatHHMM(past);
    const endTimeStr = formatHHMM(future);

    // Fill start and end times
    const startInput = popupPage.locator('label:has-text("Start time") input');
    await startInput.fill(startTimeStr);

    const endInput = popupPage.locator('label:has-text("End time") input');
    await endInput.fill(endTimeStr);

    // Select "Every day"
    const everyDayBtn = popupPage.locator('button', { hasText: 'Every day' });
    await everyDayBtn.click();

    // Submit schedule form
    const submitBtn = popupPage.locator('button', { hasText: 'Add schedule' });
    await submitBtn.click();

    // 4. Verify schedule appears in the list
    await expect(popupPage.getByText('Every day · Never ends')).toBeVisible();

    // 5. Navigate to Focus (Home) page — verify scheduled session is active!
    const focusNav = popupPage.locator('a[title="Focus"]');
    await focusNav.click();

    await expect(popupPage.locator('h1')).toContainText(/Focus Mode Active/i);

    // 6. Verify real web blocking is active for example.com
    const tab = await context.newPage();
    await tab.goto('http://example.com');
    await expect(tab).toHaveURL(new RegExp(`chrome-extension://${extensionId}/blocked/index.html`));
    await expect(tab.locator('h1')).toHaveText('Site Blocked');

    // 7. Return to Schedule page and delete the schedule
    await scheduleNav.click();
    const deleteBtn = popupPage.locator('button[aria-label^="Delete"]').first();
    await deleteBtn.click();

    // 8. Return to Focus page and verify session is released
    await focusNav.click();
    await expect(popupPage.locator('h1')).toContainText(/ready to focus/i);

    // 9. Verify web page is unblocked
    await tab.goto('http://example.com', { timeout: 10000 }).catch(() => {});
    expect(tab.url()).not.toContain('blocked/index.html');

    await tab.close();
  });
});
