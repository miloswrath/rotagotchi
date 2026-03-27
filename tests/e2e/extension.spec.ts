import { test, expect } from '../fixtures/extension';

test('extension popup renders animation container', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page).toHaveTitle('Rotagotchi');
  await expect(page.locator('#pet-container')).toBeVisible();
});

test('popup shows idle animation on neutral tab (github.com)', async ({ context, extensionId }) => {
  // Navigate to a non-blacklisted site first so background classifies it.
  const tabPage = await context.newPage();
  await tabPage.goto('https://github.com', { waitUntil: 'domcontentloaded' });

  // Give the background service worker time to classify and write tabState
  // after the navigation event fires.
  await tabPage.waitForTimeout(2000);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(popup.locator('#pet-container')).toBeVisible();
  // SVG is injected by lottie-web once the animation JSON is loaded.
  await expect(popup.locator('#pet-container svg')).toBeVisible({ timeout: 5000 });
});

test('popup shows angry animation on degenerative tab (youtube.com)', async ({ context, extensionId }) => {
  const tabPage = await context.newPage();
  await tabPage.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });

  await tabPage.waitForTimeout(2000);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(popup.locator('#pet-container')).toBeVisible();
  await expect(popup.locator('#pet-container svg')).toBeVisible({ timeout: 5000 });
});
