// Measure frames per second while walking, with shadows on and off.
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:4317/';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1280,760'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url);
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 120000 });
await page.waitForTimeout(1500);
const fps = () => page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else res(n / ((performance.now() - t0) / 1000)); };
  requestAnimationFrame(tick);
}));
await page.keyboard.down('KeyA');
console.log('shadow on, walking : fps', (await fps()).toFixed(1));
await page.keyboard.press('KeyH');
console.log('shadow off, walking: fps', (await fps()).toFixed(1));
await page.keyboard.up('KeyA');
console.log((await page.textContent('#readout')).split('\n')[2]);
await page.screenshot({ path: '../tmp/shots/20_shadow_off.png' });
await page.keyboard.press('KeyH');
await page.waitForTimeout(500);
await page.screenshot({ path: '../tmp/shots/21_shadow_on.png' });
console.log(errs.length ? errs.join('\n') : 'no page errors');
await browser.close();
