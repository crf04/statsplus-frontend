// PROTOTYPE — throwaway. `node src/matchups/gameLogsLinkPrototype/screenshots.mjs <gameId> <customToken>`
// with the dev server running on http://10.0.0.48:5173 writes /tmp/proto-logs/{A..D}-{desktop,phone}.png.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const [gameId, token] = process.argv.slice(2);
const base = 'http://10.0.0.48:5173';
mkdirSync('/tmp/proto-logs', { recursive: true });
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
    await page.goto(`${base}/matchups/${gameId}?proto=logs&v=${v}`, { waitUntil: 'networkidle' });
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
    const rail = page.locator('.player-rail');
    await rail.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/proto-logs/${v}-${label}.png` });
    const box = await rail.boundingBox();
    if (box) {
      await page.screenshot({
        path: `/tmp/proto-logs/${v}-${label}-rail.png`,
        clip: {
          x: box.x,
          y: Math.max(0, box.y),
          width: box.width,
          height: Math.min(box.height, 420),
        },
      });
    }
  }
}
await browser.close();
