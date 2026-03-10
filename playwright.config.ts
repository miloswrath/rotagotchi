import { defineConfig } from '@playwright/test';
import path from 'path';

const pathToExtension = path.resolve(__dirname, 'extension');

export default defineConfig({
  testDir: './tests',
  use: {
    headless: false,
    launchOptions: {
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
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
