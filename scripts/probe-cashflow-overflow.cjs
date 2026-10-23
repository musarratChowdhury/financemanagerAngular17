/* Diagnose horizontal overflow on the cash-flow page at mobile width.
   Finds every element wider than the viewport so we know exactly what to fix. */
const { chromium } = require('@playwright/test');

(async () => {
  const width = Number(process.env.VW || 375); // iPhone-ish
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: 667 } });

  const baseUrl = process.env.BASE_URL || 'https://financemanager.muhit.dev';
  await page.goto(baseUrl + '/login');
  await page.fill('#email', 'admin@gmail.com');
  await page.fill('#password', '123456');
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 45000 });

  await page.goto(baseUrl + '/cash-flow');
  await page.waitForSelector('.syp-flow__row, .syp-empty__title', { timeout: 45000 });
  await page.waitForTimeout(1500); // let bars/fonts settle

  const report = await page.evaluate((vw) => {
    const doc = document.documentElement;
    const out = {
      viewport: vw,
      scrollWidth: doc.scrollWidth,
      innerWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      overflows: [],
    };
    const walk = document.querySelectorAll('*');
    for (const el of walk) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > vw + 1 || r.width > vw + 1)) {
        out.overflows.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && el.className.baseVal !== undefined
            ? el.className.baseVal
            : String(el.className)).slice(0, 120),
          width: Math.round(r.width),
          right: Math.round(r.right),
          text: (el.textContent || '').trim().slice(0, 60),
        });
      }
    }
    // keep the widest offenders
    out.overflows.sort((a, b) => b.width - a.width);
    out.overflows = out.overflows.slice(0, 25);
    return out;
  }, width);

  console.log(JSON.stringify(report, null, 2));
  await page.screenshot({ path: process.env.TEMP + '\\cashflow-mobile.png', fullPage: true });
  console.log('screenshot: ' + process.env.TEMP + '\\cashflow-mobile.png');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
