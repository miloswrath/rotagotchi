import { test, expect } from '../fixtures/extension';

test('extension popup renders with expected status text', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page).toHaveTitle('Rotagotchi');
  await expect(page.locator('#status')).toBeVisible();
  await expect(page.locator('#status')).toContainText(/Ready for development\.|Extension loaded\./);
});
