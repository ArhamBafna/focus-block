import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const pathToExtension = path.resolve(__dirname, '../../apps/extension/dist');

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  popupPage: Page;
}>({
  context: async ({}, use) => {
    const isHeaded = Boolean(process.env.HEADED);
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        ...(isHeaded ? [] : ['--headless=new']),
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    const extensionId = background.url().split('/')[2];
    await use(extensionId);
  },
  popupPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await page.waitForLoadState('domcontentloaded');
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
