---
name: financemanager-e2e
description: Verify the Save Your Penny web app end-to-end with Playwright against a deployed build or a local dev server. Use when asked to test a screen, confirm a fix works in the browser, reproduce a UI bug, or check that an expense/ledger flow works. Covers login, the category picker, the Add expense flow, reading the component state, and cleaning up test rows.
compatibility: opencode
metadata:
  project: financemanagerAngular17
  stack: playwright
---

## What I do

Drive the real app in a browser and assert on what a user actually sees:
log in, fill the expense form, confirm the **Add expense** button enables,
submit, and confirm the row lands in the ledger. Also the reverse — reproduce
"the button is disabled" and find out which field is not reaching the model.

## When to use me

- "test the expenses page", "why is the button disabled", "check the fix in the
  browser", "does saving work end to end".
- Before claiming a UI fix works, run the e2e test against the **deployed**
  build — the local dev server and production differ (service worker, bundling).

## Setup

- `npx playwright install chromium` once.
- `playwright.config.ts` reads `BASE_URL` (default: the deployed site
  `https://financemanager.muhit.dev`) and `testDir: './e2e'`. The API is on a
  **different host** — read `API_URL` (default `https://fmapi.muhit.dev`) for
  direct API calls.
- Run everything: `npx playwright test`. One file: `npx playwright test e2e/expenses.spec.ts`.
- Against a local dev server: `BASE_URL=http://localhost:4200 npx playwright test`.
  Remember `src/environments/environment.development.ts` points the app at
  `https://localhost:7219`, so the local API has to be running or the login fails.

## Login

The login screen is a plain form — fill and submit it, do not try to inject a token:

```ts
await page.goto('/login');
await page.fill('#email', 'admin@gmail.com');
await page.fill('#password', '123456');
await page.click('form button[type="submit"]');
await page.waitForURL('**/dashboard');
```

The API endpoint is `api/Authentication/login` (the trailing `/api/Authentication/`
is only a `console.log` in `auth.service.ts` — a request filter on it matches nothing).

## Reading the token (for direct API calls)

`localStorage["auth-user"]` holds the token as a **JSON string**, not an object,
because `StorageService.saveUser()` is called with the token itself:

```ts
const token = await page.evaluate(() => {
  const raw = localStorage.getItem('auth-user');
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return typeof parsed === 'string' ? parsed : (parsed.token ?? null);
});
```

`JSON.parse(raw).token` is `undefined` — that mistake silently disables cleanup.

## The Add expense flow

```ts
await page.goto('/expenses');
await page.waitForSelector('#ex-title');

const addBtn = page.locator('button:has-text("Add expense")');
await expect(addBtn).toBeDisabled();          // before filling

await page.fill('#ex-title', title);
await page.selectOption('#ex-cat', { index: 1 });   // 0 = placeholder

// Syncfusion numeric text boxes only emit `change` on blur -> fill + Tab.
const qty  = page.locator('#ex-qty input.e-numerictextbox');
const unit = page.locator('#ex-unit input.e-numerictextbox');
await qty.fill('3');  await qty.press('Tab');
await unit.fill('250'); await unit.press('Tab');

await expect(addBtn).toBeEnabled({ timeout: 15000 });

const create = page.waitForResponse(
  (r) => r.url().includes('/api/Expense') && r.request().method() === 'POST');
await addBtn.click();
expect((await create).status()).toBe(200);
```

## Reading the component state (dev builds only)

`window.ng` only exists in a dev build. Use it to find out *which* field is
missing instead of guessing:

```ts
const state = await page.evaluate(() => {
  const cmp = (window as any).ng.getComponent(document.querySelector('app-expenses'));
  return { title: cmp.title, categoryId: cmp.categoryId, quantity: cmp.quantity,
           unitPrice: cmp.unitPrice, amount: cmp.amount,
           computedAmount: cmp.computedAmount, canSave: cmp.canSave };
});
```

`canSave` needs a non-empty title, a non-null `categoryId` and a positive
amount. If the button stays disabled, one of the three is not reaching the model
— that is exactly how the Syncfusion dropdown bug presented.

## Waiting correctly

- Categories load over the API, so a select briefly has only its placeholder
  option. Wait with `await expect(sel.locator('option')).not.toHaveCount(1)`.
- `page.locator('text=...')` matches **both** the mobile list and the desktop
  grid for the same row, and one is hidden by CSS → use `.first()` and assert
  `state: 'attached'`, never visibility.

## Cleaning up

The test writes to the real database. Delete the row you created:

```ts
const all = await request.get(`${API}/api/Expense/GetAll`, {
  headers: { Authorization: `Bearer ${token}` } });
const created = (await all.json()).find((e: any) => e.cause === title);
if (created) {
  await request.delete(`${API}/api/Expense/Delete/${created.id}`, {
    headers: { Authorization: `Bearer ${token}` } });
}
```

Always run the cleanup — a leftover "E2E Test Expense" row shows up in the
user's real ledger.

## Related

- `angular-syncfusion-forms` — why a Syncfusion control silently does nothing.
- `financemanager-deploy` — how to confirm a change is actually live.
