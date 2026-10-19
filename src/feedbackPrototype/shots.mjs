// PROTOTYPE — throwaway. Screenshots every variant at desktop and phone width:
//   node src/feedbackPrototype/shots.mjs <base-url> <out-dir>
import { chromium } from '@playwright/test';
const [base = 'http://127.0.0.1:4791', out = '/tmp/fbp-shots'] = process.argv.slice(2);
const browser = await chromium.launch();
const errors = [];
const sizes = { desk: { width: 1280, height: 860 }, phone: { width: 390, height: 844 } };
for (const [size, viewport] of Object.entries(sizes)) {
  for (const v of ['A', 'B', 'C', 'D']) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push(`${size}/${v}: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${size}/${v}: ${e.message}`));
    const shot = (n) => page.screenshot({ path: `${out}/${v}-${size}-${n}.png` });
    await page.goto(`${base}/matchups#proto=feedback&v=${v}`);
    await page.waitForTimeout(1500);
    await shot('1-closed');
    // open the form
    if (v === 'A') await page.locator('.fbp-a-trigger').click();
    if (v === 'B') {
      await page.locator('.fbp-b-launch').click();
      await page.waitForTimeout(200);
      await shot('2a-kinds');
      await page.locator('.fbp-b-kind').nth(1).click();
    }
    if (v === 'C') {
      await page.locator('#user-dropdown').click();
      await page.waitForTimeout(200);
      await shot('2a-menu');
      await page.getByText('Send feedback', { exact: true }).first().click();
    }
    if (v === 'D') await page.locator('.fbp-d-dock').click();
    await page.waitForTimeout(250);
    await page.keyboard.type(
      'The rebounds rank on DET @ HOU looks flipped — says 30 but they allow the fewest.',
    );
    await shot('2-form');
    if (v === 'D') await page.keyboard.press('Enter');
    else await page.locator('.fbp-primary').last().click();
    await page.waitForTimeout(300);
    await shot('3-sent');
    // error state (the phone chat covers the switcher; close it first)
    if (v === 'D' && size === 'phone') await page.locator('.fbp-d-head .fbp-icon').click();
    await page.locator('.fbp-switcher-pill').first().click();
    await page.waitForTimeout(1800);
    await shot('4-error');
    const refAction = {
      A: '.fbp-a-reflink',
      B: '.fbp-b-refbtn',
      C: '.fbp-c-refbtn',
      D: '.fbp-d-nudge-go',
    }[v];
    await page.locator(refAction).click();
    await page.waitForTimeout(300);
    await shot('5-error-open');
    if (size === 'phone') {
      if (v === 'D') await page.locator('.fbp-d-head .fbp-icon').click();
      if (v === 'A') await page.locator('.fbp-a-head .fbp-icon').click();
      if (v === 'B') await page.locator('.fbp-b-refcard textarea').blur();
    }
    await page.locator('.fbp-switcher-pill').last().click();
    await page.waitForTimeout(200);
    await shot('6-inbox');
    await ctx.close();
  }
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no console errors');
