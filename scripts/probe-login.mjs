// Deep probe of the production login flow: does the POST actually leave the
// browser, and does it ever get a response?
//
//   node scripts/probe-login.mjs

import { chromium } from 'playwright';

const SITE = process.env.BASE_URL ?? 'https://financemanager.muhit.dev';
const CREDS = { email: 'admin@gmail.com', password: '123456' };
const CHROME =
  process.env.CHROME_BIN ??
  'C:\\Users\\muhit\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';

const t0 = Date.now();
const ts = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;
const log = (...a) => console.log(ts(), ...a);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// --- capture EVERY request/response touching the API, with timing ---
page.on('request', (r) => {
  if (r.url().includes('fmapi')) log(`REQ  ${r.method()} ${r.url()}`);
});
page.on('response', (r) => {
  if (r.url().includes('fmapi')) log(`RES  ${r.status()} ${r.url()}`);
});
page.on('requestfailed', (r) => {
  if (r.url().includes('fmapi')) log(`FAIL ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`);
});
page.on('requestfinished', (r) => {
  if (r.url().includes('fmapi')) log(`FIN  ${r.method()} ${r.url()}`);
});

page.on('console', (m) => log(`CONSOLE[${m.type()}]`, m.text()));
page.on('pageerror', (e) => log(`PAGEERROR`, `${e.name}: ${e.message}`));

log('--- navigate ---');
await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('#email', { timeout: 30_000 });
log('login form ready at', page.url());

// --- what does the offline store / connectivity look like BEFORE submitting? ---
const pre = await page.evaluate(async () => {
  const out = { online: navigator.onLine, hasIndexedDB: typeof indexedDB !== 'undefined' };
  try {
    const dbs = await indexedDB.databases();
    out.databases = dbs;
  } catch (e) {
    out.databasesErr = String(e);
  }
  return out;
});
log('pre-state:', JSON.stringify(pre));

log('--- fill + submit ---');
await page.fill('#email', CREDS.email);
await page.fill('#password', CREDS.password);
await page.click('form button[type="submit"]');

const btn = page.locator('form button[type="submit"]');
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(5000);
  const label = (await btn.textContent().catch(() => '?'))?.trim();
  const url = page.url();
  log(`t+${(i + 1) * 5}s  url=${url}  button="${label}"`);
  if (!url.endsWith('/login')) {
    log('>>> NAVIGATED AWAY — login succeeded');
    break;
  }
  if (label && !/signing/i.test(label)) {
    log('>>> BUTTON RESET — request settled (success or error)');
    break;
  }
}

log('--- final state ---');
log('url:', page.url());
log('token in localStorage:', await page.evaluate(() => localStorage.getItem('auth-user')?.slice(0, 40) ?? 'null'));
const body = await page.evaluate(() => document.body?.innerText ?? '');
log('FULL BODY TEXT:');
log(body);
const errEl = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[class*="error"], [role="alert"], .syp-alert, p, span')];
  return els.map((e) => e.innerText?.trim()).filter((t) => t && /error|failed|wrong|invalid|unable|offline|network|try again/i.test(t)).slice(0, 10);
});
log('error-ish text nodes:', JSON.stringify(errEl));

await browser.close();
