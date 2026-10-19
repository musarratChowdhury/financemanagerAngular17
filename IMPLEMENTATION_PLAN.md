# Implementation Plan — what's done, what's left

> **Receipt OCR · Envelope Budget · PWA + Offline**
>
> Reconciled against both repositories on **2026-10-19**. Every claim here was read out of the
> code; where the code disagreed with an earlier draft, the code wins. The earlier draft assumed
> Angular 18, a `src/assets` layout, and a backend table for envelope limits — all three were
> wrong.
>
> **Everything below is uncommitted in both repos.** Nothing here is deployed.

---

## Status at a glance

| # | Workstream | State | Blocked on |
|---|---|---|---|
| — | **Phase 0** — prerequisites (frontend) | ✅ **Done** | — |
| — | **B4** — backend month windows | ✅ **Applied** | API redeploy |
| — | **B3** — backend data ownership | ✅ **Applied** | API redeploy |
| — | **Syncfusion setup** | ⛔ **Gate failing** — recon done, decisions open | your version-strategy call (§7) |
| 1 | **Phase 1** — PWA shell | ⬜ Not started | — |
| 2 | **Phase 2** — offline core | ⬜ Not started | — |
| 3 | **Phase 3** — envelope budget | ⬜ Not started | Phase 2; Syncfusion gate if it uses Syncfusion |
| 4 | **Phase 4** — receipt OCR | ⬜ Not started | Phases 1–2 |

Phases 1 and 2 need **no** Syncfusion work, so the gate in §7 does not block them. Phases 3 and 4
probably will need Syncfusion components — resolve the gate, or build them from Tailwind/daisyUI
plus the already-installed packages.

**The one thing that unblocks the most work: redeploy `FinanceManagerApi`** (§3). B3 and B4 are
both written and both inert until then.

---

## 1. Done — Phase 0 prerequisites (frontend)

All applied, all compile, all uncommitted.

| File | Change |
|---|---|
| `src/app/services/{expense,expense-category,receipt,dashboard}.service.ts` | **B5 fixed** — `handleError` called `error('...')`, treating the error object as a function inside `catchError` where an Observable is required. Every failed request threw a `TypeError` instead of propagating. Now matches the correct pattern already in `income.service.ts`. |
| `src/app/_helpers/uuid.ts` *(new)* + `src/models/Expense.ts` | Secure-context-safe UUID. `crypto.randomUUID()` only exists in a **secure context**, so creating an expense threw when the app was opened over plain `http://<LAN-IP>` — i.e. exactly when testing on a phone. Falls back to `crypto.getRandomValues`, then `Math.random`. Dependency-free on purpose (`package.json` already `overrides` a transitive `uuid`). |
| `src/app/_helpers/uuid.spec.ts` *(new)* | **The repo's first spec** — 4 cases covering the helper and both non-secure-context fallbacks. |
| `src/app/services/connectivity.service.ts` *(new)* + `app.component.ts` | Reactive `online` signal for templates and `isOnline()` for imperative callers. Injected in `app.component.ts` purely so its `online`/`offline` listeners register at bootstrap. **It is only a hint** — `navigator.onLine` is `true` behind a captive portal — so transport failures still have to be handled by the caller. |
| `src/app/pages/layout/dashboard/dashboard.component.ts` | No longer indexes `data[0].year` on an empty payload. |
| `.github/workflows/ci.yml` | **CI's test step was broken in two independent ways** — see §8.1. Both fixed. |

**Verified:** `ng build --configuration production` → succeeds, initial bundle 6.65 MB raw /
933.84 kB transfer. `ng test --watch=false --browsers=ChromeHeadlessNoSandbox` → `TOTAL: 4 SUCCESS`.

---

## 2. Done — B4, backend month windows

**The bug:** `ExpenseDate` is a **nullable** `DateTime` and the UI writes it, but every month
aggregation filtered on `EntryDate` — so a back-dated expense landed in the month it was *entered*.

**The fix** (5 methods in `Services/ExpenseService.cs`):

```csharp
x => (x.ExpenseDate ?? x.EntryDate) >= firstDayOfMonth &&
     (x.ExpenseDate ?? x.EntryDate) <= lastDayOfMonth
```

EF Core translates that to `COALESCE("ExpenseDate", "EntryDate")`. The parentheses are mandatory —
`x.ExpenseDate ?? x.EntryDate >= firstDay` parses `??` against a `bool` and does not compile.
Filtering on `ExpenseDate` alone would have silently **dropped** every legacy row without one.

Applied to `GetExpensesOfThisMonthAsync`, `GetExpensesOfAMonthAsync`,
`GetTotalExpensesOfAMonthAsync`, `GetMonthlyExpensesForThisYearAsync`,
`GetExpensesOfACategoryThisMonthAsync`. Three of those are unreachable from `ExpenseController`
today; they were fixed anyway so "month" cannot mean two different things if a future endpoint
wires one up. **No EF migration is required** — query change only.

---

## 3. Done — B3, backend data ownership

**The bug was worse than a display bug.** The services had no notion of "the current user":
`ExpenseController.Create` read the JWT by hand, and every read returned the whole table. So
`GET /api/Expense/{id}`, `PUT` and `DELETE` had **no ownership check at all** — any valid token
could read, edit, or delete any row by id. An IDOR, in both `ExpenseService` and `IncomeService`.

**What changed** (all in `FinanceManagerApi`):

- `Services/CurrentUser.cs` *(new)* — a scoped `ICurrentUser` exposing the JWT's `NameIdentifier`
  as a `Guid`. It **throws** rather than falling back to `Guid.Empty`, so a query can never
  silently match legacy `Guid.Empty` rows. Registered in `Program.cs` alongside
  `AddHttpContextAccessor()`.
- `Services/ExpenseService.cs`, `Services/IncomeService.cs` — every read carries
  `x.CreatedBy == _currentUser.UserId`; `Create` stamps `CreatedBy` server-side instead of
  trusting the payload.
- **Ownership on writes** — `GetById`, `Update`, `Delete` load through the same
  ownership-filtered predicate and report "not the caller's", which the controllers turn into
  **404, not 403**: a "not yours" answer must not confirm that the id exists.
- **Mass assignment closed on update.** `ExpenseProfile` maps via `ReverseMap`, and the old update
  did `_mapper.Map<Expense>(dto)` + `_dbSet.Update(entity)`, writing back the client's `CreatedBy`
  and `EntryDate`. Without this the ownership filter **self-destructs**: `ExpenseDto.CreatedBy`
  defaults to `Guid.Empty`, so every edit would have orphaned the row and made it vanish from its
  owner's list. Update now copies an allow-list of editable fields only (`Cause`, `Amount`,
  `Quantity`, `UnitPrice`, `ExpenseDate`, `ExpenseCategoryId`, `ReceiptId`).
- `Controllers/{Expense,Income}Controller.cs` — 404 when the service reports the row is not the
  caller's.

**Legacy rows.** `CreatedBy` is a non-nullable `Guid`, so no row is NULL — but the dev seed
(`Data/DbInitializer.cs`) created **4 demo expenses with `CreatedBy = Guid.Empty`**. Strict
ownership was the chosen policy: they now belong to nobody and disappear. Real rows always carried
a real `CreatedBy` from the JWT. Restoring the demo rows needs a one-off `UPDATE` assigning them to
your user id.

**Tests.** `FinanceManagerApi.Moq/ExpenseServiceTests.cs` updated for the new constructor and
extended: the month-window test proves a same-window row owned by another user is excluded, and new
tests pin "another user's row → `null`/`false` with no `UpdateAsync`/`DeleteAsync` call" and
"update preserves `CreatedBy`/`EntryDate` against a hostile payload".

**Verified:** `dotnet test FinanceManagerApi.sln` → **13/13 pass** (was 5).
`dotnet build --no-incremental` → 0 errors, no new warnings.

---

## 4. ⚠️ Waiting on you — the redeploy (highest-leverage action)

B3 and B4 are written but **both are inert until `FinanceManagerApi` is redeployed.** They ride the
same deploy.

**Two things will change in the UI, and neither is a regression:**

| After the redeploy expect… | Because | Why it's correct |
|---|---|---|
| Month totals and the bar chart **shift** | back-dated expenses move into the month they were actually spent in | B4 working |
| The expense list **shrinks** — the 4 seeded demo expenses disappear | they have `CreatedBy = Guid.Empty` and now belong to nobody | B3 working |

Confirm those two are the cause **before** filing either as a bug. **Verify B4** by calling
`GET /api/Expense/GetExpensesOfAMonth?month=..&year=..` before and after and diffing per-category
totals — rows whose `ExpenseDate` differs from `EntryDate` are what moves.

---

## 5. Left to do — Phase 1, PWA shell

No Syncfusion involvement. Unblocked; start here.

- [ ] Run `ng add @angular/pwa`, then **verify what it actually wrote** instead of assuming:
      `ngsw-config.json`, an app manifest, icons, `provideServiceWorker(...)` in `app.config.ts`,
      and `"serviceWorker": "ngsw-config.json"` in `angular.json`. The assets input is `public/`,
      so every icon/manifest path must resolve there.
- [ ] **Delete or replace `public/favicon_io/site.webmanifest`** — empty `name`, unresolvable icon
      paths. Two competing manifests will confuse the installer.
- [ ] Hand-tune `ngsw-config.json` — an `assetGroups` entry for the app shell (prefetch) plus one
      for lazy chunks/assets. **Add no `dataGroups` entry for `/api/**`** (§8.2).
- [ ] `vercel.json` — serve `ngsw-worker.js` and `ngsw.json` with `Cache-Control: no-cache`, or a
      client can pin to a stale service worker and never receive updates.
- [ ] Register with `registrationStrategy: 'registerWhenStable:30000'` so first paint isn't
      competing with the SW install.

**Done when:** `ng build --configuration production` emits `ngsw-worker.js` + `ngsw.json`;
DevTools → Application shows an activated service worker; the manifest is installable.

---

## 6. Left to do — Phases 2–4

### Phase 2 — offline core

- [ ] `storage.service.ts` — JWT `sessionStorage` → **`localStorage`** (B1), so a cold start while
      offline can still identify the user.
- [ ] `offline-store.service.ts` — IndexedDB wrapper, two stores, **both scoped by user id**: a
      `queue` of pending writes and a `cache` of last-known server reads.
- [ ] `offline-sync.service.ts` — drains the queue in order when connectivity returns, then
      refreshes the affected reads.
- [ ] `offline.interceptor.ts` — register it **last**: `withInterceptors([authInterceptor,
      offlineInterceptor])`. Interceptors run in array order on the way out, so the offline layer
      sees the request *after* the token is attached, can absorb a transport failure (not just an
      HTTP status), and can enqueue the write. It must distinguish "network unreachable" from "the
      server said 4xx/5xx" — **only the former is queued**.
- [ ] UI: navbar sync badge (online/offline + pending count) and a manual **Sync now**.
- [ ] Logout clears the cache and that user's queue, and never renders another user's cached data.

> **Not idempotent yet, by design.** Because of **B2** the server has no `ClientId` to dedupe on,
> so a replay after a lost response can create a second row. Draining in order and refreshing from
> the server after each drain bounds the damage; the real fix is B2 (§9).

**Done when:** the airplane-mode test in §10 passes.

### Phase 3 — envelope budget

- [ ] Model `EnvelopeBudget { id, userId, categoryId, month, year, limitAmount }` — **IndexedDB
      only**, scoped by user id. No backend table, no endpoint, no migration.
- [ ] Service: CRUD over the store. `spent` is **computed** from
      `GET /api/Expense/GetExpensesOfAMonth?month=&year=`, which already returns one row per
      category with the category id, its name, and the summed amount. **Nothing new is needed
      server-side.**
- [ ] `/envelopes` route + navbar entry — one row per expense category with an editable limit and a
      progress bar (green / amber / red at <80 % / 80–100 % / >100 %).
- [ ] Dashboard card listing the top N categories by utilisation.

> **`spentAmount` is deliberately never persisted on the envelope.** Derived data drifts the moment
> an expense is edited or deleted. This deletes step 5 of the old draft on purpose.

> **Note:** a progress bar is not in the installed Syncfusion set (`…-progressbar` is absent).
> Either use Tailwind/daisyUI, or add the package — which means the §7 gate applies first.

### Phase 4 — receipt OCR

Measure first, then build:

- [ ] **Measure the assets before writing code.** `eng.traineddata` is ~2 MB and the Tesseract wasm
      core several MB more. Confirm the exact filenames/versions the installed release ships and
      **self-host under `public/ocr/`** — nothing fetched from a CDN at runtime.
- [ ] **Worker** — `tesseract.js`'s `createWorker(langs, oem, options)` accepts `workerPath`,
      `corePath`, `langPath`, `dataPath`, `cachePath`/`cacheMethod`; pin them to the local copies
      and let the HTTP cache handle the big files.
- [ ] `receipt-scanner.service.ts` — wraps the worker lifecycle (`recognize` → text).
- [ ] `receipt-parser.ts` — a **pure function**, no DOM and no worker dependency, so it is directly
      unit-testable: text → `{ amount?, date?, merchant? }` via ordered regexes (total/tax/date
      lines) plus a confidence flag. **This is the file Phase 4's spec covers**, and it is exactly
      the nested spec path that the `globstar` CI fix in §8.1 was needed for.
- [ ] UI — in `expense.component` (optionally `receipt.component`): file/camera input → progress →
      a **pre-filled form the user reviews**. **Never auto-save an OCR result.**
- [ ] Lazy-load the OCR code via dynamic `import()`; keep wasm and traineddata out of the initial
      bundle.

---

## 7. ⛔ Syncfusion — blocking gate, decisions open

Recon complete; full detail in the vault note **`FinanceManager/Syncfusion-Setup.md`**.
Followed `ai.syncfusion.com` (entry `llms.txt` → `angular/llms.txt` → `licensing.md` →
`version-resolution.md`).

**Detected platform:** Angular (confirmed from the manifest, not from phrasing) —
`@angular/core` `~20.3.0`, installed **20.3.29**; namespace `@syncfusion/ej2-angular-*`; Web UI
family. No document-SDK index applies. Skill pack `syncfusion/angular-ui-components-skills`
(64 skills). MCP `@syncfusion/angular-mcp`.

### The gate fails, and it blocks code generation

Syncfusion's npm rule is that **all** `@syncfusion/*` packages share the same **major**. This repo
declares two, and three versions actually coexist on disk:

| Path | Version | Introduced by |
|---|---|---|
| `@syncfusion/ej2-data` (top level) | **26.2.14** | stray direct devDependency `^26.1.35` |
| `…/ej2-data/node_modules/@syncfusion/ej2-base` | **26.2.10** | `ej2-data@26` |
| `@syncfusion/ej2-base` (top level) | **25.2.7** | the v25 `ej2-angular-*` wrappers |
| `…/{charts,dropdowns,grids,lists,navigations}/…/ej2-data` | **25.2.3** | the v25 wrappers |

Two `ej2-base` majors and two `ej2-data` majors at once. Policy text: *"If the detected versions
are not consistent, stop immediately. Do not install, upgrade, downgrade, or generate Syncfusion
code until the user chooses a version strategy."*

**Mitigation:** `@syncfusion/ej2-data` is **never imported in `src/`** (no `DataManager`, no
`DataUtil`) — a leftover devDependency. Removing it collapses everything to major **25** with zero
code changes.

### Two defects to fix regardless of the version decision

1. **The product license key is hardcoded in source and committed** — a key literal at
   `src/main.ts:7`, in git history at `be36c2b`. **Rotate it**, then read it from the existing
   build-time env substitution (`"build": "node scripts/set-env.js && ng build"`). Never echo the
   value anywhere, including in a report.
2. **The licensing banner is being suppressed** — `src/main.ts:10–22` sets `display: none` on
   `div[style*="position: fixed"]`, the Syncfusion banner element. Syncfusion's rule 7 forbids
   hiding a banner; it must be **reported as a licensing problem**, never suppressed. **Delete the
   hack.** Also note the docs' example uses `import.meta.env`, which **Angular does not have**.

**Never infer entitlement from a key being present, and never claim a project is licensed because
it built.** An MCP API key is not a product license and grants no entitlement.

### Pending your decisions

1. **Version strategy** — drop the unused `@syncfusion/ej2-data` (cheapest, keeps major 25), align
   up to 26, or jump to the current 35 line.
2. **Skill install scope** — a targeted set for the 7 families actually imported (grid, chart,
   inputs, dropdowns, calendars, popups, notifications) plus license/themes/common, or the whole
   64-skill pack.
3. **License remediation** — rotate the key, and whether to move it to env in the same pass.

Also carried as findings: all Syncfusion packages sit in `devDependencies` though they are runtime
UI dependencies; `src/main.ts` imports `registerLicense` from `@syncfusion/ej2-base`, which is
never declared (resolves transitively).

---

## 8. Traps — each of these costs hours if hit cold

### 8.1 CI / Karma (two independent bugs, both fixed)

- **`ng test --browsers=X` can only use a launcher the builder knows about.** Angular 20's karma
  builder **ignores `karma.conf.js` unless `karmaConfig` is set in `angular.json`** — and it is not
  set here. So the builder used its own built-in config, whose only container-friendly launcher is
  **`ChromeHeadlessNoSandbox`**. CI named `ChromeHeadlessCI`, which was never registered, and died
  with `Cannot load browser "ChromeHeadlessCI"`. Fixed by using the built-in name rather than adding
  a config file that would then have to be kept in sync with Angular's.
- **The guard could not match real spec paths.** `compgen -G "src/**/*.spec.ts"` needs bash
  `globstar`; without it `**` degrades to `*`, so the pattern is effectively `src/*/*.spec.ts` and
  any deeper spec — e.g. `src/app/services/*.spec.ts` — is **silently skipped while CI reports
  green**. That is the worst failure mode, because it looks like coverage. Added
  `shopt -s globstar`. Related: `ng test` with **zero** specs does not pass quietly — it fails hard
  with `TS18003`.

### 8.2 Service worker / caching

- **Never put `/api/**` in ngsw `dataGroups`.** Service-worker cache keys ignore the
  `Authorization` header, so one user's cached expenses can be served to a different user, and the
  cache survives logout. Cache authenticated reads in IndexedDB, user-scoped, cleared on logout.
- **Service workers require a secure context.** `http://<LAN-IP>:4200` on your phone is **not** one,
  so the SW will not register at all and offline mode cannot be tested that way. Use `localhost` on
  the desktop, or a real HTTPS origin (the Vercel deploy, or an HTTPS tunnel). The same restriction
  is why `crypto.randomUUID()` failed.
- **`ng add @angular/pwa` writes paths assuming `src/assets`.** This repo serves from `public/`.
  Re-check every path it writes.
- **`ngsw-worker.js` / `ngsw.json` must be served `no-cache`** on Vercel, or clients pin to an old
  service worker.

### 8.3 Backend

- **A read-scoping fix is only half a fix when the write path round-trips the ownership column**
  (§3). Adding a read filter without fixing update would have made every edited expense orphan
  itself.
- **`x.ExpenseDate ?? x.EntryDate >= firstDay` does not compile** — `??` binds against a `bool`.
  The parentheses in §2 are load-bearing.

---

## 9. Backlog — found, deliberately not fixed

- **B1** — JWT in `sessionStorage`; fixed in Phase 2, not yet done.
- **B2** — `Expense.clientId` is generated in Angular but `Expense`/`ExpenseDto` have no `ClientId`
  column, so a queued write that reached the server but lost its response is **replayed and
  duplicated**. Fix: nullable `ClientId` + unique index, treat a re-POST of a known one as a no-op.
  This is what makes the offline queue truly idempotent.
- **`ExpenseCategory` / `IncomeCategory` reads are still account-wide.** Their `CreatedBy` is set
  per user, but `GetAll` returns every user's, so one account can see another's category **names**.
  Left alone deliberately (names-only leak; the seeded demo categories are referenced by the demo
  expenses).
- **`GetExpensesOfADay(DateTime day)`** ignores `day` entirely and returns the current month.
- **`GetExpensesOfACategoryADayAsync`** uses `x.EntryDate == day`, so it can only match midnight.
- **Syncfusion** — the version gate, the committed key, and the banner suppression (§7).

---

## 10. Acceptance checks that need your hands and hardware

I cannot do any of these — they need your phone, camera, network toggling, and the deploy.

- [ ] Deploy the updated `FinanceManagerApi`, then confirm the month totals shifted as predicted (§4).
- [ ] After that same deploy, confirm the expense list shows **only** your rows — the seeded demo
      expenses disappear (§3).
- [ ] Install the PWA on your phone from the **HTTPS** origin and confirm it launches offline.
- [ ] Airplane mode: read cached expenses, add one, re-enable the network, confirm **one** sync.
- [ ] Envelope budget: set a limit, add an expense that crosses it, confirm the bar turns red.
- [ ] OCR: photograph a real receipt on the phone and check the parser's pre-fill.

---

## 11. Locked decisions

| Question | Decision |
|---|---|
| Where is this implemented? | Frontend only, **plus two backend fixes** — B3 and B4, both done |
| Envelope limits storage | **IndexedDB only.** No backend table, no endpoint, no migration |
| Envelope "spent" value | **Always derived** from `GET /api/Expense/GetExpensesOfAMonth`, never stored |
| Offline auth | JWT `sessionStorage` → `localStorage`; the queue is keyed **per user id** |
| Caching authenticated responses | App-side IndexedDB, user-scoped. **Not** service-worker `dataGroups` |
| Build order | PWA shell → offline core → envelope budget → receipt OCR |
| B3 legacy rows (`Guid.Empty`) | **Hide from everyone** — strict `CreatedBy == me` |
| B3 "not yours" response | **404, not 403** — must not confirm the id exists |
| Should envelope work wait for B3? | **No — fix B3 first.** Done, so Phase 3 builds on correct per-user data |

The build order is deliberately *not* the old draft's. The envelope budget is built **after** the
offline layer so it is offline-aware from its first commit instead of needing a retrofit; OCR goes
last because it is heaviest and benefits from the offline cache already existing.

---

## 12. Verified baseline

| | Frontend | Backend |
|---|---|---|
| Path | `D:\Projects\financemanagerAngular17` | `D:\Projects\FinanceManagerApi` |
| Stack | Angular **20.3.29** (CLI 20.3.29, `@angular/core` 20.3.25), TypeScript 5.8, zone-based change detection, Tailwind + daisyUI, Syncfusion EJ2 | ASP.NET Core **10** Web API, EF Core + Npgsql on **CockroachDB**, JWT bearer, AutoMapper |
| Notable | Standalone components, `provideHttpClient(withInterceptors([...]))`, static assets from **`public/`** (not `src/assets`), deployed via **Vercel** (`vercel.json`), CI in `.github/workflows/ci.yml` | `IGenericRepository<T>.Filter(...)` takes `Expression<Func<T,bool>>`, CORS is `AllowAnyOrigin`, tests live in `FinanceManagerApi.Moq` (the only test project in the sln) |
| Working tree | 8 modified + 3 new files, plus this plan and your `designs/` — **all uncommitted** | 6 modified + `Services/CurrentUser.cs` new, plus your `Profiles/ExpenseProfile.cs` edit and untracked `.opencode/` — **all uncommitted** |

The README and the old draft both say "Angular 18" — stale. The CLI is 20.
