/**
 * Smoke test template for the Rotagotchi extension.
 *
 * USAGE: Copy this file to add new smoke tests for a feature.
 * Smoke tests verify fast happy-path behaviour — the extension loads and
 * a key surface is accessible. Keep them quick (no complex flows).
 *
 * The `test` import gives you access to:
 *   - `context`     — a persistent Chromium context with the extension loaded
 *   - `extensionId` — the resolved extension ID for navigating to extension pages
 */
import { test, expect } from '../fixtures/extension';

test('extension loads and popup page is accessible', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page).toHaveTitle('Rotagotchi');
});
