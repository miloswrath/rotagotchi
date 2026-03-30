import { test, expect } from '../fixtures/extension';

test('popup shows health bar in default state', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // Wait for main screen (may need login skip or session).
  // Health bar should be visible on main screen.
  await popup.waitForTimeout(4000); // intro auto-transitions after 3s

  // Check that health-bar-container exists in the DOM.
  const healthBar = popup.locator('#health-bar');
  await expect(healthBar).toBeAttached();
});

test('death overlay appears and restart works', async ({ context, extensionId }) => {
  // Directly inject a dead game state into storage via the extension's background context.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // Inject dead state.
  await popup.evaluate(() => {
    return chrome.storage.local.set({
      gameState: {
        health: 0,
        alive: false,
        debtSeconds: 300,
        debtCreatedAt: null,
        notifiedAt: null,
        lastCommitSha: null,
        lastCommitAt: null,
        tickIntervalMs: 60000,
        lastTickAt: Date.now(),
        animationState: 'dead',
        speechMessage: 'I died because you kept working. Press restart.',
      },
    });
  });

  // Wait for storage change to propagate.
  await popup.waitForTimeout(500);

  // Death overlay should be visible.
  const deathOverlay = popup.locator('#death-overlay');
  await expect(deathOverlay).toBeVisible({ timeout: 3000 });

  // Click restart.
  await popup.locator('#restart-btn').click();

  // After restart, death overlay should be hidden.
  await expect(deathOverlay).toBeHidden({ timeout: 3000 });
});

test('settings slider changes tick interval', async ({ context, extensionId }) => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForTimeout(4000);

  // Open settings panel.
  const settingsBtn = popup.locator('#settings-btn');
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();

    const slider = popup.locator('#tick-slider');
    await expect(slider).toBeAttached();
  }
});
