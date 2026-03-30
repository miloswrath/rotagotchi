import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
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
];

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      // No `channel` — use Playwright's bundled Chromium (installed via
      // `playwright install chromium`).  Specifying channel:'chromium' looks
      // for a system binary that is not present on ubuntu-latest runners.
      headless: false, // CI provides a display via xvfb-run; extensions need a real window context
      args: extensionArgs,
    });

    // Surface extension errors in CI logs so failures are diagnosable.
    context.on('page', (page) => {
      page.on('console', (msg) => {
        if (msg.type() === 'error') console.error('[browser console]', msg.text());
      });
      page.on('pageerror', (err) => console.error('[pageerror]', err));
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // CI service-worker startup can exceed the default 30 s test timeout.
    const timeout = process.env.CI ? 120_000 : 30_000;

    // MV3: look for the background service worker.
    let worker: Worker | undefined = context.serviceWorkers()[0];
    if (!worker) {
      try {
        worker = await context.waitForEvent('serviceworker', { timeout });
      } catch {
        worker = undefined;
      }
    }

    // MV2 fallback: some Chromium builds surface a background page instead.
    let url = worker?.url();
    if (!url) {
      const bg = context.backgroundPages?.()?.[0];
      if (bg) {
        url = bg.url();
      } else {
        try {
          const bg2 = await context.waitForEvent('backgroundpage', { timeout });
          url = bg2.url();
        } catch {
          // keep url undefined — error thrown below
        }
      }
    }

    if (!url || !url.startsWith('chrome-extension://')) {
      throw new Error(
        `Extension failed to load; no service worker or background page detected. ` +
          `Verify that ${pathToExtension} contains a valid manifest and all referenced files exist.`
      );
    }

    const extensionId = new URL(url).host;
    await use(extensionId);
  },
});

export const expect = test.expect;
