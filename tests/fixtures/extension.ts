import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

export type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
};

const pathToExtension = path.resolve(__dirname, '../../extension');
const extensionArgs = [
  `--disable-extensions-except=${pathToExtension}`,
  `--load-extension=${pathToExtension}`,
  '--no-sandbox',
];

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !!process.env.CI,
      args: extensionArgs,
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Wait for the service worker to register, then extract the extension ID
    // from its URL (chrome-extension://<id>/background.js)
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },
});

export const expect = test.expect;
