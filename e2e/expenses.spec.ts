import { test, expect } from '@playwright/test';

/**
 * Regression test for the "Add expense" button staying disabled.
 *
 * The button's disabled state is bound to `canSave`, which needs a title, a
 * category and a positive amount. Two things used to break that silently:
 *
 *  - the category dropdown never wrote its value back (the Syncfusion
 *    DropDownList's ControlValueAccessor methods are no-ops), so the field
 *    stayed null and the button stayed disabled;
 *  - the date was sent as a bare `yyyy-MM-dd`, which the API rejects because a
 *    date-only string deserialises with DateTimeKind.Unspecified and Npgsql
 *    will not write that into a `timestamp with time zone` column.
 *
 * The test creates a real expense and removes it again afterwards.
 */

const CREDS = { email: 'admin@gmail.com', password: '123456' };

/** The API lives on its own host, so relative URLs in the app do not resolve to it. */
const API = process.env.API_URL ?? 'https://fmapi.muhit.dev';

test('Add expense enables once the form is filled and saves successfully', async ({
  page,
  request,
}) => {
  const title = `E2E Test Expense ${Date.now()}`;

  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  // ---------------------------------------------------------------- login
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#email', { timeout: 60_000 });

  const loginResp = page.waitForResponse((r) =>
    r.url().includes('/api/Authentication/login')
  );
  await page.fill('#email', CREDS.email);
  await page.fill('#password', CREDS.password);
  await page.click('form button[type="submit"]');
  expect((await loginResp).status()).toBe(200);
  await page.waitForURL('**/dashboard', { timeout: 30_000 });

  // ------------------------------------------------------- expenses page
  await page.goto('/expenses', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ex-title', { timeout: 60_000 });

  const addBtn = page.locator('button:has-text("Add expense")');
  await expect(addBtn).toBeDisabled();

  // ------------------------------------------------------------ fill form
  await page.fill('#ex-title', title);
  await page.selectOption('#ex-cat', { index: 1 });

  // Syncfusion numeric text boxes only emit `change` once the field is blurred.
  const qty = page.locator('#ex-qty input.e-numerictextbox');
  const unit = page.locator('#ex-unit input.e-numerictextbox');
  await qty.fill('3');
  await qty.press('Tab');
  await unit.fill('250');
  await unit.press('Tab');

  await expect(addBtn).toBeEnabled({ timeout: 15_000 });

  // --------------------------------------------------------- submit & save
  const createResp = page.waitForResponse(
    (r) => r.url().includes('/api/Expense') && r.request().method() === 'POST',
    { timeout: 30_000 }
  );
  await addBtn.click();

  const cr = await createResp;
  console.log(`POST /api/Expense -> ${cr.status()}`);
  expect(cr.status()).toBe(200);

  // The ledger renders the same rows twice (mobile list + desktop grid) and one
  // of the two is hidden by CSS, so assert on attachment rather than visibility.
  await page.locator('text=' + title).first().waitFor({ state: 'attached' });

  // ----------------------------------------------------------- clean up
  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('auth-user');
    return raw ? (JSON.parse(raw).token ?? null) : null;
  });
  if (token) {
    const all = await request.get(`${API}/api/Expense/GetAll`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const created = (await all.json()).find((e: any) => e.cause === title);
    if (created) {
      await request.delete(`${API}/api/Expense/Delete/${created.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(`cleaned up expense ${created.id}`);
    }
  }
});
