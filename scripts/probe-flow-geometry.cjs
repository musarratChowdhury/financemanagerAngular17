/* Measure flow track/fill geometry at any width. */
const { chromium } = require('@playwright/test');

(async () => {
  const vw = Number(process.env.VW || 1024);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: vw, height: 900 } });
  await page.goto('http://localhost:4399/login');
  await page.fill('#email', 'admin@gmail.com');
  await page.fill('#password', '123456');
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 45000 });
  await page.goto('http://localhost:4399/cash-flow');
  await page.waitForSelector('.syp-flow__row', { state: 'attached', timeout: 45000 });
  await page.waitForTimeout(1200);

  const rows = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.syp-flow__row').forEach((row) => {
      const track = row.querySelector('.syp-flow__track');
      const fill = row.querySelector('.syp-flow__fill');
      const name = row.querySelector('.syp-flow__name');
      const cs = track ? getComputedStyle(track) : null;
      out.push({
        name: name ? name.textContent.trim() : '',
        rowWidth: Math.round(row.getBoundingClientRect().width),
        trackWidth: track ? Math.round(track.getBoundingClientRect().width) : null,
        fillWidth: fill ? Math.round(fill.getBoundingClientRect().width) : null,
        fillInlineWidth: fill ? fill.style.width : null,
        trackMinWidth: cs ? cs.minWidth : null,
        trackFlex: cs ? cs.flex : null,
      });
    });
    return out.slice(0, 4);
  });
  console.log(JSON.stringify(rows, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
