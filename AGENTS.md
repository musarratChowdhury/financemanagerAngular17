# AGENTS.md

Quick reference for working in this repo (the Angular web app for Save Your Penny).
Keep it terse — only facts an agent is likely to miss.

The API lives in a sibling repo: `../FinanceManagerApi`. The two deploy
independently (see "Deploy" below), so a fix on one side is not live until its
own pipeline has run.

## Repo shape

- Angular 20 standalone components, Tailwind 3 + daisyUI 4, Syncfusion 25.2 (charts, grids, calendars, inputs, notifications, popups).
- `src/app/pages/layout/**` — the real screens (dashboard, expenses, categories, scan-receipt, cash-flow, current-needs, envelopes, settings).
- `src/app/pages/{login,register}/` — auth screens.
- `src/app/services/**` — one service per API area. `src/app/_helpers/` — money/date helpers, HTTP interceptors.
- `src/syp-theme.css` — the app's own design system (`syp-*` classes, CSS custom properties, light theme). `src/styles.css` — Syncfusion CSS imports + Tailwind entry points. Both are registered in `angular.json` `build.options.styles`.
- Routes: `src/app/app.routes.ts`. Everything under the `LayoutComponent` parent is behind `authGuard`.

## Common commands

- Install: `npm ci`
- Dev server: `npm start` → `http://localhost:4200`
- Production build: `npm run build` (runs `scripts/set-env.js` first — it **rewrites** `src/environments/environment.ts` from `API_URL` / `SYNCFUSION_LICENSE_KEY` env vars, defaults to `https://fmapi.muhit.dev`)
- Unit tests (karma): `npm test` — needs Chrome. Set `CHROME_BIN` to a real browser first (`C:\Program Files\Google\Chrome\Application\chrome.exe` here) and pass a launcher the Angular 20 builder knows: `npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`. Naming a custom launcher fails unless `karmaConfig` is set in `angular.json`.
- E2E (Playwright): `npx playwright test` — see `e2e/` and `playwright.config.ts`.
- Tailwind's `content` glob is `./src/**/*.{html,ts}`, so class names only exist in templates get purged. daisyUI themes are `night` + `cupcake` and **no `data-theme` is set anywhere**, so daisyUI's own components render dark — use them only on the older daisyUI-styled screens, and the `syp-*` classes on the redesigned ones.

## Two design systems, pick by screen

- The redesigned screens (dashboard, expenses, categories, scan-receipt, cash-flow, current-needs, envelopes) use the `syp-*` classes from `src/syp-theme.css` — light, custom, with a hand-rolled select (`.syp-select`) and input (`.syp-input`).
- `expense.component.*` and `receipt.component.*` are the **old** daisyUI-styled screens (`btn btn-sm btn-info`). They are **not routed** — `/expense` and `/receipt` redirect to `/expenses` and `/scan-receipt` — so they are effectively dead code. Change them only to keep them compiling and consistent.

## Gotchas that will burn you

- **Syncfusion's Angular wrappers have empty `ControlValueAccessor` stubs.** `@syncfusion/ej2-angular-dropdowns`'s `DropDownListComponent.registerOnChange()` / `writeValue()` are empty bodies, so `[(ngModel)]` on `<ejs-dropdownlist>` silently does nothing — no error, the field just never updates. Same shape in the other `ej2-angular-*` wrappers. **Check the wrapper's `.mjs` before trusting any `[(ngModel)]` / `formControlName` on a Syncfusion component.** The category pickers are now native `<select>` elements for exactly this reason; do not reintroduce `ejs-dropdownlist`.
- **Syncfusion `ejs-numerictextbox` / `ejs-datepicker` only emit `change` on blur.** A Playwright `fill()` never reaches the component — you must `fill()` then `press('Tab')`.
- **Each `ejs-numerictextbox` renders a hidden mirror input** (`input.e-numeric-hidden`). Target the visible `input.e-numerictextbox` or Playwright fails with a strict-mode violation.
- **`computed()` signals never re-evaluate when the fields they read are plain class fields.** `canSave` / `computedAmount` on the expense form are plain **getters** on purpose: with default (zone) change detection a getter re-evaluates on every CD cycle, whereas a `computed()` would cache its first (empty) result forever and keep the button disabled. Don't "modernise" them back to `computed()` unless the form fields become signals too.
- **The auth token is stored as a JSON *string*, not an object.** `StorageService.saveUser()` is called with the token itself, so `localStorage["auth-user"]` is `"\"eyJ...\""`. Read it with `JSON.parse(raw)` and handle the string case — `JSON.parse(raw).token` is `undefined`.
- **The service worker is enabled in production** (`provideServiceWorker('ngsw-worker.json')`). After a deploy the browser may serve a cached `ngsw-worker.js` / asset bundle; when a fix appears not to land, check `navigator.serviceWorker.controller` and the `ngsw:/:db:<hash>:assets:app:cache` cache names before assuming the deploy failed. The Angular bundle filename is content-hashed, so a new deploy normally invalidates it.
- `authInterceptor` logs `authToken found` on **every** request. Noisy but harmless; it is a cleanup candidate.
- **`syp-theme.css` styles a `.syp-*` block as a whole (e.g. `.syp-flow { display: flex; align-items: center }` with legacy fixed widths); when a page restyles the same classes in its scoped component CSS, it must ALSO redefine the container and the properties it doesn't list** — scoped selectors win on what they set, but the theme's container/display/width rules still apply. Cause of the cash-flow "Where the … went" horizontal scroll: theme's flex strip + `align-items: center` shrank every row to content width (~88px) and pushed page scrollWidth to 1201px even though the row grid CSS was deployed and correct. Fix in `cash-flow.component.css` by restating `.syp-flow { display: flex; flex-direction: column; align-items: stretch; padding: 0 }` and `width: auto` on the theme's fixed-width children. Verify such UI bugs with real measurement (Playwright: compare `document.documentElement.scrollWidth` vs `innerWidth`, then walk elements by `getBoundingClientRect().right` — NOT by width; sorted-by-width scans hide narrow elements parked far right).
- `src/environments/environment.development.ts` points at `https://localhost:7219` (the local API). `environment.ts` (production) is overwritten by the build script — never hand-edit it expecting it to stick.
- **The receipt-scan model choice is per-browser, not per-account.** `ReceiptModelService` keeps it in `localStorage` (`syp-receipt-model` = `{ model, source, savedAt }`, `syp-receipt-model-tests` = last verdict per model), so `StorageService.clean()` on sign-out wipes it. `source: 'manual'` is never replaced by the startup sweep — only `null` or `'auto'` are. The sweep runs from `LayoutComponent.ngOnInit` (2 s delay) and stands down while a scan is in flight.
- **Settings needs the API deployed first.** `/api/Receipt/Models` and `/api/Receipt/Probe` are new; an older API answers 404 and the page shows "deploy the API". The dropdown lists only models whose `supportsGenerateContent` is true, and the Test button sends `strict=true` so the server's fallback chain cannot make a dead model look healthy.

## The date contract with the API

`Expenses.ExpenseDate` is `timestamp with time zone`. Npgsql refuses to write a
`DateTime` whose `Kind` is not `Utc`, and a JSON date-only string deserialises
with `Kind=Unspecified` → the insert fails with a 500.

So the API payload must carry an explicit instant: use **`isoUtcDate()`** from
`src/app/_helpers/money.ts` (`yyyy-MM-ddT00:00:00.000Z`), not `isoDate()`
(`yyyy-MM-dd`, which is only for `<input type="date">`). The API also normalises
an Unspecified date server-side, but the client should still send a UTC value.

## Deploy

- **Web**: pushing to `main` runs `.github/workflows/ci.yml` (build + audit + karma tests) — it has **no deploy step**. The site is deployed by Vercel's GitHub integration on push. A green CI run does not mean the site is updated; verify by fetching the site's `index.html` and comparing the `main-<hash>.js` filename, then re-fetch the bundle and grep it for your change.
- **API**: pushing to `main` in `../FinanceManagerApi` runs `CI/CD` — build, test, push the Docker image, apply EF migrations to CockroachDB, then notify Render. It has been failing often enough that a stale image on Docker Hub is normal; check the run before assuming a change is live.
- Production hosts: web `https://financemanager.muhit.dev`, API `https://fmapi.muhit.dev`. The API talks to a CockroachDB Cloud cluster (`weird-gorilla-7085.8nk.gcp-asia-southeast1.cockroachlabs.cloud:26257`, db `financedb`, user `musarrat`) — the password lives in the API repo, never in this repo. Note the API repo's `FinanceManagerApi/CockroachConnect.txt` holds a **stale** password; use the API repo's `scripts/check-sequence.py` / `scripts/probe-api.py`, which try several sources and pick the one that authenticates.

## Project scripts (`scripts/`) — reuse these, don't recreate them

- **`scripts/verify-deployed.py`** — what is actually live on the site. Prints the deploy time and the content-hashed bundle name, then checks markers inside it:
  ```
  python scripts/verify-deployed.py --grep "get canSave(){return this.title.trim().length>0" --not-grep "ejs-dropdownlist"
  ```
  `--grep` = must be present, `--not-grep` = must be absent (for removed code). Use this instead of hand-fetching `index.html` and grepping the bundle.
- The Playwright specs live in `e2e/` — see "E2E conventions" below.

## Project skills (`.opencode/skills/`)

- **`financemanager-e2e`** — drive the app in a real browser: login, the Add expense flow, reading the component state, cleaning up test rows.
- **`angular-syncfusion-forms`** — why a Syncfusion control silently does nothing, and how to replace it with a native element.
- **`financemanager-deploy`** — push → pipeline → verify for both repos, and how to tell a stale service worker from a failed deploy.

Load them with the `skill` tool by name.

## E2E conventions (`e2e/`)

- `playwright.config.ts` sets `baseURL` from `BASE_URL` (defaults to the deployed
  site) and `testDir: './e2e'`. The API host is separate — the tests read
  `API_URL` (defaults to `https://fmapi.muhit.dev`) for direct API calls.
- Login is a real form fill: `#email` + `#password`, then `form button[type="submit"]`.
  The API URL is `api/Authentication/login` (no trailing path variant).
- Wait for the category list before asserting on option counts — the categories
  arrive over the API, so the select briefly has only its placeholder option.
- `page.locator('text=...')` matches **both** the mobile list and the desktop
  grid rendering of the same row, and one of them is hidden by CSS. Use
  `.first()` and assert on `state: 'attached'`, not visibility.
- The e2e test creates a real expense and deletes it again via
  `DELETE /api/Expense/Delete/{id}`; always leave the ledger clean.
