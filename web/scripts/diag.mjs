import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.ZL_DATA && !document.getElementById('loader'), null, { timeout: 30000 });
const r = await page.evaluate(async () => {
  const fw = document.getElementById('filmWrap');
  const rc = fw.getBoundingClientRect();
  const { tMin, tMax, nowDefault } = window.ZL_DATA.anchors;
  const ev = (type, x) => fw.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: x, clientY: rc.top + 10, isPrimary: true }));
  ev('pointerdown', rc.left + rc.width * 0.3);
  ev('pointermove', rc.right - 2);
  await new Promise(rs => requestAnimationFrame(() => requestAnimationFrame(rs)));
  const xTs = tMin + (1 - 2 / rc.width) * (tMax - tMin);
  const upX = rc.right - 2;
  ev('pointerup', upX);
  await new Promise(r2 => setTimeout(r2, 900));
  return {
    anchors: { tMin: new Date(tMin).toISOString(), tMax: new Date(tMax).toISOString(), nowDefault: new Date(nowDefault).toISOString(), tMaxMinus48h: new Date(tMax - 48 * 36e5).toISOString() },
    expectedTs: new Date(xTs).toISOString(),
    distToNow: (xTs - nowDefault) / 36e5,
    chip: document.getElementById('modeChip').textContent,
    origin: document.getElementById('originDate').textContent,
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
