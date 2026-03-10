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
    channel: 'chromium',
    headless: !!process.env.CI,
    launchOptions: {
      args: extensionArgs,
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
