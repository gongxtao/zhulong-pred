import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
for (let run = 1; run <= 3; run++) {
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
  const reqs = [];
  page.on('request', r => { const u = r.url(); if (u.includes('supabase.co/rest/v1/energy_hourly')) reqs.push(u.slice(-90)); });
  await page.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.ZL_DATA && !document.getElementById('loader'), null, { timeout: 30000 });
  // 模拟 verify：等 live + 在线徽章后立即采样
  await page.waitForFunction(() => window.ZL_DATA && window.ZL_DATA.src === 'live' && document.getElementById('srcText').textContent.includes('在线'), null, { timeout: 45000 });
  const snap = await page.evaluate(() => ({
    mode: document.getElementById('modeChip').textContent,
    origin: document.getElementById('originDate').textContent,
    quad: [...document.querySelectorAll('#statusQuad .sq-v')].map(e => e.textContent.trim()),
    cov: [document.getElementById('cov90v').textContent, document.getElementById('cov50v').textContent],
    renderLog: window.__renderLog,
    liveHours: window.ZL_DATA.liveHours,
  }));
  console.log(`RUN${run}`, JSON.stringify(snap));
  await page.close();
}
await browser.close();
