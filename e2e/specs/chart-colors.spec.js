import { E2E_AUTH_STORAGE_KEY, expect, installApiContract, test } from '../fixtures/courtai';

// Chart.js paints with whatever colours its options carry. Record each draw
// call with the style the canvas normalised for it, so the test reads which
// colour reached which part of the chart. A clearRect starts a frame.
const recordCanvasPaint = () => {
  const proto = CanvasRenderingContext2D.prototype;
  for (const op of ['clearRect', 'fill', 'fillRect', 'stroke', 'strokeRect', 'fillText']) {
    const original = proto[op];
    proto[op] = function record(...args) {
      const style = String(op.startsWith('stroke') ? this.strokeStyle : this.fillStyle);
      const text = op === 'fillText' ? String(args[0]) : null;
      (this.canvas.ctOps ??= []).push({ op, style, text });
      return original.apply(this, args);
    };
  }
};

const paintOf = (canvas, { latestFrame = false } = {}) =>
  canvas.evaluate((element, latest) => {
    const ops = element.ctOps ?? [];
    const frame = latest ? ops.slice(ops.findLastIndex(({ op }) => op === 'clearRect')) : ops;
    const painted = frame.filter(({ op }) => op !== 'clearRect');
    return [...new Set(painted.map(({ style }) => style))].sort();
  }, latestFrame);

// The colours of the Game Logs chart's parts in its latest frame. A label draws
// its ground (fill), then its edge (stroke), then its text.
const gameLogRoles = (canvas) =>
  canvas.evaluate((element) => {
    const ops = element.ctOps ?? [];
    const lastText = (pattern, before = ops.length) =>
      ops.slice(0, before).findLastIndex(({ op, text }) => op === 'fillText' && pattern.test(text));
    const lastBefore = (at, kinds) => ops.slice(0, at).findLast(({ op }) => kinds.includes(op));
    const roles = {};
    const label = lastText(/^Line: /);
    if (label !== -1) {
      const ground = ops.slice(0, label).findLastIndex(({ op }) => op === 'fill');
      Object.assign(roles, {
        line: lastBefore(ground, ['stroke'])?.style,
        labelGround: ops[ground]?.style,
        labelEdge: lastBefore(label, ['stroke'])?.style,
        labelText: ops[label].style,
      });
    }
    // A frame strokes its grid lines first, then each axis's border and labels.
    const lastTick = lastText(/^\d+$/);
    if (lastTick !== -1) {
      const frame = ops.slice(0, lastTick).findLastIndex(({ op }) => op === 'clearRect');
      Object.assign(roles, {
        grid: ops.slice(frame + 1).find(({ op }) => op === 'stroke')?.style,
        tick: ops[lastTick].style,
      });
    }
    return roles;
  });

test('charts paint the dark theme colours, part by part, and repaint in Chalk when the theme changes', async ({
  page,
}) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await page.addInitScript(recordCanvasPaint);
  await installApiContract(page);
  await page.goto('/?player_name=LeBron+James');

  const gameLogChart = page.locator('.chart-container canvas');
  await expect
    .poll(() => paintOf(gameLogChart))
    .toEqual(expect.arrayContaining(['rgba(194, 78, 78, 0.72)', 'rgba(76, 175, 125, 0.78)']));
  const { width, height } = await gameLogChart.boundingBox();
  // The game strip under the chart opens on the most recent game, the last bar.
  const strip = page.getByRole('region', { name: 'Picked game' });
  await expect(strip).toContainText('vs ATL · game 2 of 2');
  // Over the first game's bar once it has grown in, which picks that game.
  await expect
    .poll(async () => {
      await gameLogChart.hover({ position: { x: width * 0.3, y: height * 0.7 } });
      return strip.textContent();
    })
    .toContain('@ DAL · game 1 of 2');
  // A keyboard step with the pointer still on that bar holds, though Chart.js
  // replays the pointer's last event after the redraw.
  await strip.getByRole('button', { name: 'Next game' }).focus();
  await page.keyboard.press('Enter');
  await expect(strip).toContainText('vs ATL · game 2 of 2');
  await expect(strip.getByRole('button', { name: 'Next game' })).toBeDisabled();
  await expect
    .poll(() => gameLogRoles(gameLogChart))
    .toEqual({
      line: '#e8a33d',
      labelGround: '#1e1a12',
      labelEdge: 'rgba(232, 163, 61, 0.4)',
      labelText: '#e8a33d',
      grid: 'rgba(255, 255, 255, 0.06)',
      tick: '#9b937f',
    });
  // The old tooltip titled itself with the game's ISO date; ticks read 1/8.
  expect(
    await gameLogChart.evaluate((element) =>
      element.ctOps.some(({ text }) => text === '2025-01-08'),
    ),
  ).toBe(false);

  // A theme is a set of token values under html[data-theme]. This one exists
  // only for the test, and moves every token pair that is equal in dark but
  // plays different roles apart (the text accent from its fill, a line's
  // alpha from a wash's, page white from lettering on an accent), so a chart
  // part on the wrong one shows. It must repaint without a reload.
  await page.addStyleTag({
    content: `:root[data-theme='e2e-probe'] {
      --ct-gold: #123456;
      --ct-surface-2: #234567;
      --ct-text-max: #345678;
      --ct-slate: #456789;
      --ct-k-accent-fg: 2;
      --ct-k-accent-bg: 0.5;
      --ct-k-overlay-fg: 2;
      --ct-k-overlay-bg: 0.5;
    }`,
  });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'e2e-probe'));
  await expect
    .poll(() => gameLogRoles(gameLogChart))
    .toEqual({
      line: '#123456',
      labelGround: '#234567',
      labelEdge: 'rgba(232, 163, 61, 0.8)',
      labelText: '#123456',
      grid: 'rgba(255, 255, 255, 0.12)',
      tick: '#9b937f',
    });
  // Bars are data marks: their alpha holds in every theme. Off the chart, no
  // bar wears its hover colour.
  await page.mouse.move(0, 0);
  await expect
    .poll(() => paintOf(gameLogChart, { latestFrame: true }))
    .toEqual(expect.arrayContaining(['rgba(194, 78, 78, 0.72)', 'rgba(76, 175, 125, 0.78)']));

  // Chalk, chosen in the Appearance menu: text and lines take the light
  // tokens, line alphas grow by 1.35, and the bars keep their colours.
  await page.getByRole('button', { name: 'Appearance: System (Dark)' }).click();
  await page.getByRole('menuitemradio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => window.localStorage.getItem('courtai:theme'))).toBe('light');
  await expect
    .poll(() => gameLogRoles(gameLogChart))
    .toEqual({
      line: '#8f5404',
      labelGround: '#f7f8fa',
      labelEdge: 'rgba(143, 84, 4, 0.54)',
      labelText: '#8f5404',
      // 0.06 x 1.35 = 0.081, which the canvas keeps as 21/255.
      grid: 'rgba(21, 24, 29, 0.082)',
      tick: '#5f6670',
    });
  await page.mouse.move(0, 0);
  await expect
    .poll(() => paintOf(gameLogChart, { latestFrame: true }))
    .toEqual(expect.arrayContaining(['rgba(194, 78, 78, 0.72)', 'rgba(76, 175, 125, 0.78)']));
});
