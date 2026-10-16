// Stays in Playwright: of the ten Slate tests, the other nine moved to
// e2e/flows/slate.e2e.ts and this spec was cut down to the one test that
// observes browser requests. It asserts that the browser asked for the slate of
// 2026-01-15 and of 2026-01-10 with `page.on('request')`. e2e's `api.sent` sees
// only what reaches the /api contract, so a request that arrives by redirect
// passes here and fails there (see "slate" in MIGRATION.md).
import { expect, installApiContract, slateGame, slatePayload, test } from '../fixtures/courtai';

test('@critical authenticated user opens a slate and navigates dates', async ({
  authenticatedPage: page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  const requests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/slate') requests.push(request.url());
  });
  await installApiContract(page, {
    '/api/games/slate': (request) => {
      const date = new URL(request.url()).searchParams.get('date') || '2026-01-15';
      if (date === '2026-01-14') return slatePayload(date, []);
      if (date === '2026-01-10') {
        return slatePayload(
          date,
          [
            {
              ...slateGame,
              game_id: '0022500541',
              away_team: {
                ...slateGame.away_team,
                tricode: 'NYK',
                name: 'New York Knicks',
              },
              home_team: {
                ...slateGame.home_team,
                tricode: 'MIL',
                name: 'Milwaukee Bucks',
              },
              scheduled_at: '2026-01-11T01:00:00Z',
              status: { state: 'final', label: 'Final' },
              classification: null,
            },
          ],
          {
            poolFreshnessStatus: 'fresh',
            poolRetrievedAt: '2026-01-15T11:50:00Z',
          },
        );
      }
      return slatePayload(date, [slateGame], {
        poolFreshnessStatus: 'stale-served',
        poolRetrievedAt: '2026-01-15T10:00:00Z',
        providers: {
          prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T11:40:00Z' },
          underdog: { status: 'missing', retrieved_at: null },
        },
      });
    },
  });

  await page.goto('/matchups?date=2026-01-15');

  await expect(page.getByRole('heading', { name: 'Thursday, January 15, 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'LAL @ BOS' })).toBeVisible();
  const viewerLocalTip = await page.evaluate((scheduledAt) => {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(scheduledAt),
    );
  }, slateGame.scheduled_at);
  await expect(page.getByText(viewerLocalTip, { exact: true })).toBeVisible();
  await expect(page.getByText('Los Angeles Lakers at Boston Celtics')).toBeVisible();
  await expect(page.getByLabel('9 targetable players, LAL 5, BOS 4')).toBeVisible();
  // One mark per targetable player, grouped away then home.
  await expect(page.locator('.slate-pip')).toHaveCount(9);
  await expect(page.getByText('NBA Paris Game')).toBeVisible();
  await expect(page.getByText('Preseason')).toHaveCount(0);
  await expect(page.getByText(/schedule is fresh.*as of/i)).toBeVisible();
  const freshness = page.getByRole('group', { name: 'Data freshness' });
  await expect(freshness.getByText(/player pool is stale-served/i)).toBeVisible();
  await expect(freshness.getByText(/underdog pool is missing/i)).toBeVisible();
  await expect(
    page.getByText(/prizepicks pool is stale.*older than 15m freshness bar/i),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('slate-stale-pool.png'), fullPage: true });

  await page.getByRole('button', { name: 'Previous date' }).click();
  await expect(page).toHaveURL(/date=2026-01-14/);
  await expect(page.getByText('No games on this slate.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('slate-empty.png'), fullPage: true });

  await page.getByLabel('Slate date').fill('');
  await expect(page).toHaveURL(/\/matchups\?date=2026-01-15$/);
  await expect(page.getByRole('heading', { name: 'Thursday, January 15, 2026' })).toBeVisible();
  expect(requests.some((url) => new URL(url).searchParams.get('date') === '2026-01-15')).toBe(true);

  await page.getByLabel('Slate date').fill('2026-01-10');
  await expect(page).toHaveURL(/date=2026-01-10/);
  await expect(page.getByRole('heading', { name: 'NYK @ MIL' })).toBeVisible();
  await expect(
    page.getByText(/current player pool is not displayed for historical dates/i),
  ).toBeVisible();
  await expect(
    page.getByText(/final game cards retain the posted targetable counts/i),
  ).toBeVisible();
  await expect(page.getByLabel('9 targetable players, NYK 5, MIL 4')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('slate-past.png'), fullPage: true });
  expect(requests.some((url) => new URL(url).searchParams.get('date') === '2026-01-10')).toBe(true);

  // Today is reachable from any date, not only as recovery from a bad one.
  await page.getByRole('button', { name: 'Today' }).click();
  await expect(page).toHaveURL(/\/matchups\?date=2026-01-15$/);
  await expect(page.getByRole('heading', { name: 'Thursday, January 15, 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Today' })).toBeDisabled();
});
