import { defineConfig } from '@playwright/test';
import path from 'path';

const pathToExtension = path.resolve(__dirname, 'extension');
const extensionArgs = [
  `--disable-extensions-except=${pathToExtension}`,
  `--load-extension=${pathToExtension}`,
  '--no-sandbox',
];

export default defineConfig({
  testDir: './tests',
  // Persistent contexts + extensions are more fragile under parallelism; run
  // serially on CI to avoid race conditions and resource contention.
  workers: process.env.CI ? 1 : undefined,
  // Must exceed the fixture's 120 s waitForEvent timeout so the test harness
  // doesn't kill fixture setup before the service worker registers.
  timeout: 150_000,
  use: {
    // No `channel` — use Playwright's bundled Chromium installed via
    // `playwright install chromium` (system Chromium is absent on CI).
    // Extensions require headless:false; CI provides a display via xvfb-run.
    headless: false,
    launchOptions: {
      args: [
        ...extensionArgs,
        '--disable-setuid-sandbox',
      ],
    },
  },
  projects: [
    {
      name: 'e2e',
      testMatch: 'e2e/**/*.spec.ts',
    },
    {
      name: 'smoke',
      testMatch: 'smoke/**/*.spec.ts',
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
