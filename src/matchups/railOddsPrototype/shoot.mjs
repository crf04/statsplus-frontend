// PROTOTYPE — throwaway. Screenshots every variant of a served standalone build.
// Usage: node shoot.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', args: ['--headless=new'] });
const sizes = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
const errors = [];
for (const game of ['0022600001', '0022600003'])
  for (const v of ['A', 'B', 'C', 'D'])
    for (const [w, viewport] of Object.entries(sizes)) {
      const page = await browser.newPage({ viewport });
      page.on('console', (m) => m.type() === 'error' && errors.push(`${game} ${v} ${w}: ${m.text()}`));
      await page.goto(`${base}/matchups/${game}?odds=${v}`);
      await page.waitForSelector('.rail-row');
      if (w === 'phone') await page.locator('.player-rail').scrollIntoViewIfNeeded();
      else await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${game}-${v}-${w}.png` });
      await page.close();
    }
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
