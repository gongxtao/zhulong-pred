import { chromium } from '/Users/mac/Develop/project/guikesong/web/node_modules/playwright-core/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, 'zhulong-rollup-banner.html');
const outPath = path.resolve(__dirname, 'preview.png');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 2600 }, deviceScaleFactor: 0.5 });
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
await page.waitForSelector('.qr-box canvas', { state: 'attached', timeout: 10000 });
await page.evaluate(() => {
  document.documentElement.style.setProperty('--s', '1.18');
  document.querySelector('.stage').style.padding = '0';
  document.querySelector('.toolbar').style.display = 'none';
});
await page.waitForTimeout(1200);
const banner = await page.$('.banner');
await banner.screenshot({ path: outPath });
await browser.close();
console.log('Screenshot:', outPath);
