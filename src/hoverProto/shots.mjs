// PROTOTYPE — throwaway. node src/hoverProto/shots.mjs <base-url> <out-dir>
import { chromium } from '@playwright/test';
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch();
const cases = [
  ['brunson-pts', '/?player_name=Jalen+Brunson&season_filter=2026-27'],
  ['towns-reb', '/?player_name=Karl-Anthony+Towns&season_filter=2026-27&line_type=REB'],
];
const errors = [];
for (const [w, h, tag] of [[1440, 1000, 'desktop'], [390, 844, 'phone']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const [name, path] of cases)
    for (const v of ['O', 'D', 'E', 'F', 'G']) {
      await page.goto(`${base}${path}#proto=hover&v=${v}`);
      const canvas = page.locator('.chart-container canvas').first();
      await canvas.waitFor();
      await page.waitForTimeout(1200);
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      // Hover the third bar from the right.
      await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.6);
      await page.waitForTimeout(500);
      const scrollY = await page.evaluate(() => window.scrollY);
      const strip = await page.locator('.hv-strip, .hv-e, .hv-f, .hv-g').first().boundingBox().catch(() => null);
      const chart = await canvas.boundingBox();
      const top = Math.min(chart.y, strip?.y ?? chart.y);
      const bottom = Math.max(chart.y + chart.height, strip ? strip.y + strip.height : 0);
      const clip = { y: top, height: bottom - top };
      await page.screenshot({
        fullPage: true,
        path: `${out}/${tag}-${name}-${v}.png`,
        clip: { x: 0, y: Math.max(0, clip.y + scrollY - 10), width: w, height: clip.height + 20 },
      });
    }
  await page.close();
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
