import { test, expect } from '@playwright/test';

/** Smallest valid PNG - the receipt scanner only needs a file to advance a step. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test('the expenses category picker is a native select that writes through', async ({
  page,
}) => {
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { timeout: 60_000 });
  await page.fill('#email', 'admin@gmail.com');
  await page.fill('#password', '123456');
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 30_000 });

  // ------------------------------------------------------------- /expenses
  await page.goto('/expenses', { waitUntil: 'domcontentloaded' });
  const sel = page.locator('#ex-cat');
  await sel.waitFor({ state: 'attached', timeout: 30_000 });
  await expect(sel.locator('option')).not.toHaveCount(1, { timeout: 30_000 });

  const options = await sel.locator('option').count();
  console.log(`/expenses  <select> options=${options}`);
  expect(await sel.evaluate((e) => e.tagName)).toBe('SELECT');
  expect(await page.locator('ejs-dropdownlist').count()).toBe(0);

  // picking an option must write through to the component model
  const before = await sel.inputValue();
  await sel.selectOption({ index: 1 });
  const after = await sel.inputValue();
  console.log(`           value ${before || '(empty)'} -> ${after}`);
  expect(after).not.toBe(before);

  // ---------------------------------------------------------- /scan-receipt
  await page.goto('/scan-receipt', { waitUntil: 'domcontentloaded' });
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: 'attached', timeout: 30_000 });
  await fileInput.setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: TINY_PNG });

  const srCat = page.locator('#sr-cat');
  await srCat.waitFor({ state: 'attached', timeout: 30_000 });
  await expect(srCat.locator('option')).not.toHaveCount(1, { timeout: 30_000 });

  console.log(
    `/scan-receipt  <select> options=${await srCat.locator('option').count()}`
  );
  expect(await srCat.evaluate((e) => e.tagName)).toBe('SELECT');
  expect(await page.locator('ejs-dropdownlist').count()).toBe(0);

  const srBefore = await srCat.inputValue();
  await srCat.selectOption({ index: 1 });
  console.log(`           value ${srBefore || '(empty)'} -> ${await srCat.inputValue()}`);
});
