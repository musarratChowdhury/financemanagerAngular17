import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4200';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#email', 'admin@gmail.com');
await page.fill('#password', '123456');
await page.click('form button[type="submit"]');
await page.waitForURL(/dashboard|expenses/, { timeout: 30000 });
await page.waitForTimeout(3000);

const stack = await page.evaluate(() => {
  const link = document.querySelector('app-mobilebar a[aria-label="Settings"]');
  const r = link.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;

  const describe = (el) => {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      cls: (el.className?.toString?.() ?? '').slice(0, 50),
      id: el.id || null,
      position: cs.position,
      zIndex: cs.zIndex,
      pointerEvents: cs.pointerEvents,
      rect: { t: Math.round(b.top), l: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height) },
      text: (el.textContent ?? '').trim().slice(0, 60),
    };
  };

  return {
    point: { x: Math.round(x), y: Math.round(y) },
    stack: document.elementsFromPoint(x, y).slice(0, 8).map(describe),
    bodyChildren: [...document.body.children].map((el) => {
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className?.toString?.() ?? '').slice(0, 40),
        position: cs.position,
        zIndex: cs.zIndex,
        rect: { t: Math.round(b.top), l: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height) },
      };
    }),
  };
});

console.log(JSON.stringify(stack, null, 2));
await browser.close();
