import { test, expect } from '../fixtures/extension';

test('extension loads and popup page is accessible', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page).toHaveTitle('Rotagotchi');
});

test('popup renders pet-container and mounts animation', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // Container must be present.
  await expect(page.locator('#pet-container')).toBeVisible();

  // lottie-web injects an SVG into the container once the animation JSON is fetched.
  await expect(page.locator('#pet-container svg')).toBeVisible({ timeout: 5000 });

  // No JS errors should be logged (check for error elements injected by the browser).
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.waitForTimeout(500);
  expect(errors).toHaveLength(0);
});
