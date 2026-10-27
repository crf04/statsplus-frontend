import { E2E_AUTH_STORAGE_KEY, expect, installApiContract, test } from '../fixtures/courtai';

// Chart.js paints with whatever colours its options carry. Record each draw
// call with the style the canvas normalised for it, so the test reads which
// colour reached which part of the chart.
const recordCanvasPaint = () => {
  const proto = CanvasRenderingContext2D.prototype;
  for (const op of ['fill', 'fillRect', 'stroke', 'strokeRect', 'fillText']) {
    const original = proto[op];
    proto[op] = function record(...args) {
      const style = String(op.startsWith('stroke') ? this.strokeStyle : this.fillStyle);
      const text = op === 'fillText' ? String(args[0]) : null;
      (this.canvas.ctOps ??= []).push({ op, style, text });
      return original.apply(this, args);
    };
  }
};

const paintOf = (canvas) =>
  canvas.evaluate((element) =>
    [...new Set((element.ctOps ?? []).map(({ style }) => style))].sort(),
  );

// The colours of the Game Logs chart's parts in its latest frame. A label or a
// tooltip draws its ground (fill), then its edge (stroke), then its text.
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
    const body = lastText(/^OPP: /);
    if (body !== -1) {
      Object.assign(roles, {
        tooltipGround: lastBefore(body - 1, ['fill'])?.style,
        tooltipEdge: lastBefore(body - 1, ['stroke'])?.style,
        tooltipTitle: ops[body - 1].style,
        tooltipBody: ops[body].style,
      });
    }
    const axisTitle = lastText(/^PTS$/);
    if (axisTitle !== -1) {
      Object.assign(roles, {
        grid: lastBefore(axisTitle, ['stroke'])?.style,
        axisTitle: ops[axisTitle].style,
        tick: ops[lastText(/^\d+$/)]?.style,
      });
    }
    return roles;
  });

// A two-category Playtypes profile against the opponent's Team Defense.
const profileOverrides = {
  '/api/players/profile': () => ({ body: { 'PRBallHandler%': 31.4, 'Isolation%': 17.8 } }),
  '/api/teams/stats': () => ({
    body: { PRBallHandler: 1.14, PRBallHandler_RANK: 27, Isolation: 0.86, Isolation_RANK: 4 },
  }),
};

test('charts paint the dark theme colours, part by part, and repaint when the theme changes', async ({
  page,
}) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await page.addInitScript(recordCanvasPaint);
  await installApiContract(page, profileOverrides);
  await page.goto('/?player_name=LeBron+James');

  const gameLogChart = page.locator('.chart-container canvas');
  await expect
    .poll(() => paintOf(gameLogChart))
    .toEqual(expect.arrayContaining(['rgba(194, 78, 78, 0.72)', 'rgba(76, 175, 125, 0.78)']));
  const { width, height } = await gameLogChart.boundingBox();
  // Over the second game's bar once it has grown in, which raises the tooltip.
  await expect
    .poll(async () => {
      await gameLogChart.hover({ position: { x: width * 0.65, y: height * 0.7 } });
      return gameLogRoles(gameLogChart);
    })
    .toEqual({
      line: '#e8a33d',
      labelGround: '#1e1a12',
      labelEdge: 'rgba(232, 163, 61, 0.4)',
      labelText: '#e8a33d',
      tooltipGround: '#1e1a12',
      tooltipEdge: 'rgba(255, 255, 255, 0.16)',
      tooltipTitle: '#efe9dc',
      tooltipBody: '#9b937f',
      grid: 'rgba(255, 255, 255, 0.06)',
      axisTitle: '#9b937f',
      tick: '#9b937f',
    });

  const playtypes = page.getByRole('img', { name: 'Playtype frequency and team defense chart' });
  const playtypesCanvas = playtypes.locator('canvas');
  await playtypes.scrollIntoViewIfNeeded();
  await expect(playtypes).toBeVisible();
  await expect
    .poll(() => paintOf(playtypesCanvas), { timeout: 20_000 })
    .toEqual(expect.arrayContaining(['#e8a33d', '#7a8699']));
  await expect
    .poll(async () => {
      await playtypes.hover({ position: { x: 90, y: 150 } });
      return paintOf(playtypesCanvas);
    })
    .toEqual(
      expect.arrayContaining([
        '#666666', // axis and tick marks
        '#7a8699', // Team Defense line
        '#808080', // axis titles
        '#9b937f', // tick labels
        '#cccccc', // hover cursor
        '#e8a33d', // frequency bars
        '#ffffff', // line points
        'rgba(255, 255, 255, 0.08)', // grid
      ]),
    );

  // A theme is a set of token values under html[data-theme]. This one exists
  // only for the test; the chart must take its colours without a reload.
  await page.addStyleTag({
    content: ":root[data-theme='e2e-probe'] { --ct-gold: #123456; --ct-surface-2: #234567; }",
  });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'e2e-probe'));
  await expect
    .poll(() => gameLogRoles(gameLogChart))
    .toMatchObject({ line: '#123456', labelGround: '#234567', labelText: '#123456' });
});
