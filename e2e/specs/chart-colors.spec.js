import { E2E_AUTH_STORAGE_KEY, expect, installApiContract, test } from '../fixtures/courtai';

// Chart.js paints with whatever colours its options carry. Record every fill
// and stroke style each canvas is given, as the canvas itself normalises it,
// so the test reads the colours that reach the screen.
const recordCanvasPaint = () => {
  const proto = CanvasRenderingContext2D.prototype;
  for (const property of ['fillStyle', 'strokeStyle']) {
    const { get, set } = Object.getOwnPropertyDescriptor(proto, property);
    Object.defineProperty(proto, property, {
      configurable: true,
      get,
      set(value) {
        set.call(this, value);
        const painted = get.call(this);
        if (typeof painted === 'string') (this.canvas.ctPaint ??= new Set()).add(painted);
      },
    });
  }
};

const paintOf = (canvas) => canvas.evaluate((element) => [...(element.ctPaint ?? [])].sort());

// A two-category Playtypes profile against the opponent's Team Defense.
const profileOverrides = {
  '/api/players/profile': () => ({ body: { 'PRBallHandler%': 31.4, 'Isolation%': 17.8 } }),
  '/api/teams/stats': () => ({
    body: { PRBallHandler: 1.14, PRBallHandler_RANK: 27, Isolation: 0.86, Isolation_RANK: 4 },
  }),
};

test('charts paint the dark theme colours', async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await page.addInitScript(recordCanvasPaint);
  await installApiContract(page, profileOverrides);
  await page.goto('/?player_name=LeBron+James');

  const gameLogChart = page.locator('.chart-container canvas');
  await expect
    .poll(() => paintOf(gameLogChart))
    .toEqual(expect.arrayContaining(['rgba(76, 175, 125, 0.78)']));
  const { width, height } = await gameLogChart.boundingBox();
  // Over the second game's bar once it has grown in, which raises the tooltip.
  await expect
    .poll(async () => {
      await gameLogChart.hover({ position: { x: width * 0.65, y: height * 0.7 } });
      return paintOf(gameLogChart);
    })
    // Hovered marks also animate through Chart.js hover tints, so these are subsets.
    .toEqual(
      expect.arrayContaining([
        '#1e1a12', // line label and tooltip ground
        '#9b937f', // ticks, axis title and tooltip body
        '#e8a33d', // the line and its label text
        '#efe9dc', // tooltip title
        'rgba(0, 0, 0, 0.1)', // the empty chart before logs arrive
        'rgba(194, 78, 78, 0.72)', // under the line
        'rgba(232, 163, 61, 0.4)', // line label edge
        'rgba(255, 255, 255, 0.06)', // grid
        'rgba(255, 255, 255, 0.16)', // tooltip edge
        'rgba(76, 175, 125, 0.78)', // over the line
      ]),
    );

  const playtypes = page.getByRole('img', { name: 'Playtype frequency and team defense chart' });
  await expect(playtypes).toBeVisible();
  await expect
    .poll(async () => {
      await playtypes.hover({ position: { x: 90, y: 150 } });
      return paintOf(playtypes.locator('canvas'));
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
});
