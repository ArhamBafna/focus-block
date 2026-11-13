import type { BrowserContext, Page } from '@playwright/test';

/**
 * Helper to execute code in the extension's service worker context.
 */
export async function evalInServiceWorker<T>(
  context: BrowserContext,
  fn: () => Promise<T> | T
): Promise<T> {
  const [background] = context.serviceWorkers();
  if (!background) {
    throw new Error('No service worker found in browser context');
  }
  return background.evaluate(fn);
}

/**
 * Directly inspect chrome.storage.local from extension background context.
 */
export async function getStorageLocal(context: BrowserContext, key?: string): Promise<any> {
  const [background] = context.serviceWorkers();
  return background.evaluate((storageKey) => {
    return new Promise((resolve) => {
      chrome.storage.local.get(storageKey ? [storageKey] : null, (result) => {
        resolve(storageKey ? result[storageKey] : result);
      });
    });
  }, key);
}

/**
 * Set chrome.storage.local from extension background context.
 */
export async function setStorageLocal(context: BrowserContext, items: Record<string, any>): Promise<void> {
  const [background] = context.serviceWorkers();
  await background.evaluate((data) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set(data, () => resolve());
    });
  }, items);
}

/**
 * Clear chrome.storage.local.
 */
export async function clearStorageLocal(context: BrowserContext): Promise<void> {
  const [background] = context.serviceWorkers();
  await background.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.clear(() => resolve());
    });
  });
}
