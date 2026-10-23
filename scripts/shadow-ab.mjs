// Same sunlit spot, same camera: screenshot with the cast shadow on and off.
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:4317/';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1280,760'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url);
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 120000 });
await page.evaluate(() => { Object.assign(window.pos, { x: -0.9, z: -2.9 }); window.camera.yaw = 35; window.camera.pitch = 22; window.camera.distance = 4.2; });
await page.waitForTimeout(1500);
await page.screenshot({ path: '../tmp/shots/30_ab_on.png' });
await page.keyboard.press('KeyH');
await page.waitForTimeout(800);
await page.screenshot({ path: '../tmp/shots/31_ab_off.png' });
await browser.close();
