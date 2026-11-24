import { test, expect } from '@playwright/test';

/**
 * The indicator has to notice a backend that is not answering, which is exactly
 * what `navigator.onLine` cannot do: the device keeps its network while Render
 * is down. This drives the real chip against a deliberately aborted /health.
 */
test('the API indicator reports a backend that stopped answering', async ({
  page,
}) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { timeout: 60_000 });
  await page.fill('#email', 'admin@gmail.com');
  await page.fill('#password', '123456');
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 30_000 });

  // Desktop view: the phone app bar is `display:none` from 1024px up, so the
  // rail chip inside the sidebar is the one on screen (and the only --rail).
  const chip = page.locator('button.apistat--rail');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('Online', { timeout: 30_000 });

  // Cut the health endpoint, then ask the chip to re-check by hand.
  await page.route(/\/health(\?|$)/, (route) => route.abort());
  await chip.click();

  // A fresh run of failures is "Starting…", not "Offline": a Render cold start
  // looks identical, and only the 60s grace window separates the two.
  await expect(chip).toContainText('Starting…');

  await page.unroute(/\/health(\?|$)/);
  await chip.click();
  await expect(chip).toContainText('Online');
});
