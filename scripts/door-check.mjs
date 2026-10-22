// Stand the character in the hall doorway and screenshot, to judge scale.
import { chromium } from 'playwright-core';
const out = process.argv[2] || '../tmp/shots';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1280,760'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:4317/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/10_spawn.png` });
// The doorway sits about 1.0 file units in front of the capture point.
await page.evaluate(() => { const s = window.env.entity.getLocalScale().x; window.pos.z = -1.0 * s; window.pos.x = 0; window.pos.y = 0.15; });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/11_door.png` });
console.log(await page.textContent('#readout'));
for (let i = 0; i < 4; i++) await page.keyboard.press('BracketLeft');
await page.waitForTimeout(1200);
console.log('after [ x4:', (await page.textContent('#readout')).split('\n')[1]);
await page.keyboard.press('Backslash');
await page.waitForTimeout(800);
console.log('after \\:', (await page.textContent('#readout')).split('\n')[1]);
console.log(logs.join('\n'));
await browser.close();
