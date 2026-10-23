// A/B test the production login latency:
//   A) service worker ENABLED   (what users get)
//   B) service worker BLOCKED
//   C) raw fetch() from the page context (bypasses Angular HttpClient entirely)
//   D) repeat A to check reproducibility
//
//   node scripts/probe-latency.mjs

import { chromium } from 'playwright';

const SITE = process.env.BASE_URL ?? 'https://financemanager.muhit.dev';
const API = process.env.API_URL ?? 'https://fmapi.muhit.dev';
const CREDS = { email: 'admin@gmail.com', password: '123456' };
const CHROME =
  process.env.CHROME_BIN ??
  'C:\\Users\\muhit\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});

async function run(label, { blockSW }) {
  const ctx = await browser.newContext({ serviceWorkers: blockSW ? 'block' : 'allow' });
  const page = await ctx.newPage();
  const apiTimes = [];
  page.on('response', async (r) => {
    if (r.url().includes('/api/Authentication/login')) {
      apiTimes.push({ status: r.status(), at: Date.now() });
    }
  });

  await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#email', { timeout: 30_000 });

  const sw = await page.evaluate(
    async () => !!(await navigator.serviceWorker?.getRegistrations?.())?.length
  );

  const t = Date.now();
  await page.fill('#email', CREDS.email);
  await page.fill('#password', CREDS.password);
  await page.click('form button[type="submit"]');

  // wait for the login response
  const deadline = Date.now() + 60_000;
  let res = null;
  while (Date.now() < deadline) {
    res = await page
      .waitForResponse((r) => r.url().includes('/api/Authentication/login'), { timeout: 2000 })
      .catch(() => null);
    if (res) break;
  }
  const elapsed = Date.now() - t;
  const status = res ? res.status() : 'TIMEOUT';
  console.log(
    `${label.padEnd(34)} swRegistered=${String(sw).padEnd(5)} login=${String(status).padEnd(7)} ${elapsed} ms`,
  );
  await ctx.close();
  return elapsed;
}

console.log('--- Angular HttpClient login latency ---');
await run('A) SW enabled (first visit)', { blockSW: false });
await run('B) SW blocked', { blockSW: true });
await run('C) SW enabled (repeat)', { blockSW: false });

// --- raw fetch, bypassing Angular HttpClient AND the Angular SW data path ---
console.log('');
console.log('--- raw fetch() from page context ---');
const ctx = await browser.newContext({ serviceWorkers: 'allow' });
const page = await ctx.newPage();
await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('#email', { timeout: 30_000 });

for (let i = 1; i <= 3; i++) {
  const r = await page.evaluate(async ({ API, CREDS }) => {
    const t = performance.now();
    try {
      const res = await fetch(`${API}/api/Authentication/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CREDS),
      });
      await res.text();
      return { ms: Math.round(performance.now() - t), status: res.status };
    } catch (e) {
      return { ms: Math.round(performance.now() - t), status: 'THREW', err: String(e) };
    }
  }, { API, CREDS });
  console.log(`raw fetch #${i}: ${r.ms} ms -> ${r.status}${r.err ? ' ' + r.err : ''}`);
}

await ctx.close();
await browser.close();
