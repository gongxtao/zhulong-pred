import { chromium } from '/Users/mac/Develop/project/guikesong/web/node_modules/playwright-core/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, 'zhulong-rollup-banner.html');
const outPath = path.resolve(__dirname, 'zhulong-rollup-80x200.pdf');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
// 等待二维码 canvas 渲染完成
await page.waitForSelector('.qr-box canvas', { state: 'attached', timeout: 10000 });
await page.waitForTimeout(800); // 字体/布局稳定

await page.pdf({
  path: outPath,
  width: '800mm',
  height: '2000mm',
  printBackground: true,
  pageRanges: '1',
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log('PDF exported:', outPath);
