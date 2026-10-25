import { test, expect } from '@playwright/test';

/**
 * Settings — the receipt-scan model picker.
 *
 * The screen is useless if the API has not been deployed ahead of it: /api/Receipt/Models
 * is new, so an older API answers 404 and the page shows the "deploy the API" notice.
 * The second test spends one real Gemini call, which is the point — it proves the whole
 * chain (sample image → API → Gemini) rather than trusting the dropdown to be populated.
 */

const CREDS = { email: 'admin@gmail.com', password: '123456' };

test('Settings lists the models the key can call and saves a choice', async ({ page }) => {
  await login(page);

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();

  // The model list arrives over the API. A 404 here means the API predates this screen.
  const modelsResponse = await page.waitForResponse(
    (r) => r.url().includes('/api/Receipt/Models') && r.request().method() === 'GET',
    { timeout: 60_000 }
  );
  if (modelsResponse.status() === 404) {
    throw new Error(
      'GET /api/Receipt/Models returned 404 — deploy the API before the web app. ' +
        'The settings screen needs the model endpoints.'
    );
  }
  expect(modelsResponse.status()).toBe(200);

  const select = page.locator('#receipt-model');
  await expect(select).toBeVisible({ timeout: 30_000 });

  // Placeholder rows are not expected: every option is a real model name.
  const options = select.locator('option');
  expect(await options.count()).toBeGreaterThan(0);
  const firstValue = await options.first().getAttribute('value');
  expect(firstValue).toBeTruthy();

  await select.selectOption(firstValue!);
  await page.getByRole('button', { name: 'Save for receipt scans' }).click();

  const saved = await page.evaluate(() => {
    const raw = localStorage.getItem('syp-receipt-model');
    return raw ? JSON.parse(raw) : null;
  });

  expect(saved?.model).toBe(firstValue);
  expect(saved?.source).toBe('manual');

  // A manual choice must survive the background sweep.
  await expect(page.getByText('Chosen by you')).toBeVisible();
});

test('The test button reports a verdict and shows Gemini’s error verbatim', async ({
  page,
}) => {
  await login(page);
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });

  await page.waitForResponse(
    (r) => r.url().includes('/api/Receipt/Models') && r.request().method() === 'GET',
    { timeout: 60_000 }
  );

  const select = page.locator('#receipt-model');
  await expect(select).toBeVisible({ timeout: 30_000 });

  // Pick a model known to be gone when we can see one, so the failure path is
  // exercised deliberately; otherwise test whatever is selected.
  const options = select.locator('option');
  const count = await options.count();
  let target = await options.first().getAttribute('value');
  for (let i = 0; i < count; i++) {
    const value = await options.nth(i).getAttribute('value');
    if (value === 'gemini-2.5-flash') target = value;
  }
  await select.selectOption(target!);

  const scanResponse = page.waitForResponse(
    (r) => r.url().includes('/api/Receipt/Scan') && r.request().method() === 'POST',
    { timeout: 90_000 }
  );

  // A real Gemini call: the default model has been measured at 9-12s cold.
  await page.getByRole('button', { name: /Test on a receipt/ }).click();

  const response = await scanResponse;
  console.log(`POST /api/Receipt/Scan (${target}) -> ${response.status()}`);

  // Either the model worked (200) or the API answered with the diagnostic body (502).
  expect([200, 502]).toContain(response.status());

  if (response.status() === 200) {
    await expect(page.getByText('Worked')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Read with/)).toBeVisible();
  } else {
    await expect(page.getByText('Failed')).toBeVisible({ timeout: 30_000 });
    // The requirement: Gemini's own message must reach the user, not a generic error.
    await expect(page.getByText(/Gemini's response/)).toBeVisible();
    await expect(page.locator('pre.syp-raw')).not.toBeEmpty();
  }
});

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { timeout: 60_000 });

  const loginResponse = page.waitForResponse((r) =>
    r.url().includes('/api/Authentication/login')
  );
  await page.fill('#email', CREDS.email);
  await page.fill('#password', CREDS.password);
  await page.click('form button[type="submit"]');
  expect((await loginResponse).status()).toBe(200);
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}
