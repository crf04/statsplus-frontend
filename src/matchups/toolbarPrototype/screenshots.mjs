// PROTOTYPE — throwaway. `node src/matchups/toolbarPrototype/screenshots.mjs <gameId> <customToken>`
// with the proxy dev server running (see README) writes /tmp/proto-toolbar/{A..C}-{desktop,phone}*.png.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [gameId, token] = process.argv.slice(2);
const base = process.env.PROTO_BASE || 'http://192.168.4.241:5173';
const out = '/tmp/proto-toolbar';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/matchups`);
await page.evaluate(async (tok) => {
  const src = await (await fetch('/src/firebase/config.js')).text();
  const dep = src.match(/"(\/node_modules\/\.vite\/deps\/firebase_auth\.js[^"]*)"/)[1];
  const cfg = await import('/src/firebase/config.js');
  const fa = await import(dep);
  await fa.signInWithCustomToken(cfg.auth, tok);
}, token);
for (const [label, w, h] of [
  ['desktop', 1440, 900],
  ['phone', 390, 844],
]) {
  await page.setViewportSize({ width: w, height: h });
  for (const v of ['A', 'B', 'C', 'D']) {
    await page.goto(`${base}/matchups/${gameId}?proto=toolbar&v=${v}`, {
      waitUntil: 'networkidle',
    });
    await page.locator('.player-card').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    console.log(
      v,
      label,
      await page
        .locator('.proto-switcher')
        .innerText()
        .catch(() => 'MISSING'),
    );
    await page.screenshot({ path: `${out}/${v}-${label}.png` });
    if (label === 'phone') {
      await page.locator('.detail-controls').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${out}/${v}-${label}-controls.png` });
    }
  }
}
await browser.close();
