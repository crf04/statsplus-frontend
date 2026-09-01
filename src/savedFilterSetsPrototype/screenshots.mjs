// PROTOTYPE — throwaway. `node src/savedFilterSetsPrototype/screenshots.mjs`
// with `npm start` already running writes /tmp/proto-{A,B,C}.png.
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const v of ['A', 'B', 'C']) {
  await page.goto(`http://localhost:5173/#proto=saved&v=${v}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  console.log(v, '=> url', page.url());
  console.log(
    v,
    '=> switcher',
    await page
      .locator('.proto-switcher')
      .innerText()
      .catch(() => 'MISSING'),
  );
  const shell = await page
    .locator('.proto-modal, .proto-drawer')
    .first()
    .innerText()
    .catch(() => 'MISSING');
  console.log(v, '=> content:\n' + shell.split('\n').slice(0, 24).join('\n'));
  await page.screenshot({ path: `/tmp/proto-${v}.png` });
  console.log('---');
}
await browser.close();
