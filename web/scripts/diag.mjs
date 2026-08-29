import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
await page.request.get('http://localhost:3100/').catch(() => {});
await page.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.ZL_DATA && !document.getElementById('loader'), null, { timeout: 30000 });
await sleep(2000);
const card = page.locator('#stageCard');
await card.screenshot({ path: '../.shots/diag_stage.png' });
// 同时列出主图系列里的 markArea/markLine 构成
const marks = await page.evaluate(() => {
  const opt = window.__zlCharts.mainC.getOption();
  return opt.series.filter(s => s.markArea || s.markLine).map(s => ({
    name: s.name,
    markArea: s.markArea ? s.markArea.data.length : 0,
    markLine: s.markLine ? s.markLine.data.length : 0,
    area: s.markArea ? JSON.stringify(s.markArea.data).slice(0, 120) : null,
  }));
});
console.log(JSON.stringify(marks, null, 1));
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
await browser.close();
