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
  '--disable-setuid-sandbox',
  // Extensions are unsupported in legacy headless mode; use the new headless
  // implementation on CI so the service worker and popup load correctly.
  ...(process.env.CI ? ['--headless=new'] : []),
];

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      // No `channel` — use Playwright's bundled Chromium (installed via
      // `playwright install chromium`).  Specifying channel:'chromium' looks
      // for a system binary that is not present on ubuntu-latest runners.
      headless: false, // controlled via --headless=new arg above instead
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
