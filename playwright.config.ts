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
  use: {
    // No `channel` — use Playwright's bundled Chromium installed via
    // `playwright install chromium` (system Chromium is absent on CI).
    // Extensions break in legacy headless; pass --headless=new on CI instead.
    headless: false,
    launchOptions: {
      args: [
        ...extensionArgs,
        '--disable-setuid-sandbox',
        ...(process.env.CI ? ['--headless=new'] : []),
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
