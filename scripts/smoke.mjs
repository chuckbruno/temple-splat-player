// Drive the built player in Chrome: wait for load, walk, kick, screenshot.
import { chromium } from 'playwright-core';
const out = process.argv[2] || '../tmp/shots';
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--window-size=1280,760', '--enable-unsafe-webgpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:4317/');
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 120000 })
  .catch(() => logs.push('[smoke] loading never finished'));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/01_spawn.png` });
console.log('READOUT0', await page.textContent('#readout'));
await page.keyboard.down('KeyW'); await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/02_walk.png` });
await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/03_run.png` });
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
await page.waitForTimeout(600);
await page.keyboard.press('KeyL'); await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/04_kick.png` });
await page.waitForTimeout(1500);
await page.keyboard.press('KeyC');
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/05_collider.png` });
console.log('READOUT1', await page.textContent('#readout'));
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
