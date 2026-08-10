import { expect, installApiContract, matchupPayload, test } from '../fixtures/courtai';

test('@critical user opens a Defense Sheet and changes local spotting controls', async ({
  authenticatedPage: page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  const matchupRequests = [];
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/matchup')
      matchupRequests.push(request.url());
  });

  await page.goto('/matchups?date=2026-01-15');
  await page.getByRole('link', { name: 'Open Team Sheets' }).click();
  await expect(page).toHaveURL(/\/matchups\/0022500584$/);
  await expect(page.getByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();
  await expect(page.getByText('Transition')).toBeVisible();
  await expect(page.getByText('Above-break three')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shot zones' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shot types' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assist locations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Traditional defense' })).toBeVisible();
  await expect(page.getByText('Isolation')).toHaveCount(0);
  await expect(page.getByText('1 row hidden near league average.')).toBeVisible();
  await expect(page.getByText('+12% vs league')).toBeVisible();
  await expect(page.getByText('-11% vs league')).toBeVisible();
  await expect(page.getByText(/LeBron James · 19% poss/)).toBeVisible();
  await expect(page.getByText(/LeBron James · 27% FGA/)).toBeVisible();
  await expect(page.getByText(/LeBron James · 36% FGA/)).toBeVisible();
  await expect(page.getByText(/LeBron James · 31% ast/)).toBeVisible();
  await expect(page.getByText(/Austin Reaves · 40% FGA/)).toHaveCount(0);
  await expect(page.getByText(/Austin Reaves · 35% ast/)).toHaveCount(0);
  await expect(page.getByText('15.2 per 48')).toBeVisible();
  await expect(page.getByText('2 targetable returned')).toBeVisible();
  await expect(page.getByRole('article', { name: 'LeBron James player' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Maxi Kleber player' })).toHaveCount(0);
  await expect(page.getByText('Game-time decision')).toHaveCount(2);
  await expect(page.getByText('Maxi Kleber')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-desktop.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Last 15' }).click();
  await expect(page.getByText('-8% vs league')).toBeVisible();
  await expect(page.getByText(/LeBron James · 20% poss/)).toBeVisible();

  await page.getByRole('button', { name: 'PTS' }).click();
  await expect(page.getByRole('article', { name: 'LeBron James player' })).toBeVisible();
  await page.getByRole('button', { name: 'Matchup Score' }).click();
  const sortedPlayers = page.getByRole('article', { name: /player$/ });
  await expect(sortedPlayers.first()).toHaveAccessibleName('Austin Reaves player');
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-score-sort.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'FGA' }).click();
  await expect(page.getByText('Transition')).toBeVisible();
  await expect(page.getByText('Above-break three')).toHaveCount(0);
  await page.getByRole('button', { name: 'All deviations' }).click();
  await expect(page.getByText('0 rows hidden near league average.')).toBeVisible();

  await page.getByRole('button', { name: 'LAL defense' }).click();
  await expect(page.getByRole('heading', { name: 'LAL Defense Sheet' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Jayson Tatum player' })).toBeVisible();
  expect(matchupRequests).toHaveLength(1);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('matchup renders stale and unavailable surfaces without inventing data', async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  await installApiContract(page, {
    '/api/games/matchup': {
      ...matchupPayload,
      players: [],
      injuries: {
        ...matchupPayload.injuries,
        status: 'unavailable',
        unavailable_reason: 'permission_required',
        retrieved_at: null,
        teams: [],
      },
      freshness: {
        ...matchupPayload.freshness,
        pool: { status: 'unavailable', retrieved_at: null, providers: {} },
        stats: { status: 'stale', retrieved_at: '2026-01-13T10:00:00Z' },
        injuries: { status: 'missing', retrieved_at: null },
      },
    },
  });

  await page.goto('/matchups/0022500584');
  await expect(page.getByText(/pool: unavailable.*pool data warning/i)).toBeVisible();
  await expect(page.getByText(/stats: stale.*stats data warning/i)).toBeVisible();
  await expect(page.getByText('No posted players are available for this market.')).toBeVisible();
  await expect(page.getByText('Injury report unavailable: permission_required.')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-degraded.png'),
    fullPage: true,
  });
});

test('matchup detail is usable at a narrow viewport with keyboard-only controls', async ({
  authenticatedPage: page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/matchups/0022500584');
  await expect(page.getByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();
  await page.getByRole('button', { name: 'BOS defense' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'All', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'PTS' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: testInfo.outputPath('matchup-detail-narrow.png'), fullPage: true });
});

test('matchup exposes a truthful loading state before the fixture resolves', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  await installApiContract(page, {
    '/api/games/matchup': async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return matchupPayload;
    },
  });
  await page.goto('/matchups/0022500584', { waitUntil: 'commit' });
  await expect(page.getByRole('status')).toHaveText('Loading matchup…');
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-loading.png'),
    fullPage: true,
  });
  await expect(page.getByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();
});

test('matchup freshness ages cross named bars without refetching', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-15T12:00:00Z') });
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  await installApiContract(page, {
    '/api/games/matchup': {
      ...matchupPayload,
      freshness: {
        ...matchupPayload.freshness,
        schedule: { status: 'fresh', retrieved_at: '2026-01-14T06:01:00Z' },
      },
    },
  });
  let matchupRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/matchup') matchupRequests += 1;
  });
  await page.goto('/matchups/0022500584');
  const freshness = page.getByRole('region', { name: 'Matchup data freshness' });
  await expect(freshness.getByText(/^pool: fresh, as of 10m ago$/i)).toBeVisible();

  await page.clock.runFor(6 * 60 * 1000);
  await expect(
    freshness.getByText(/pool: stale, as of 16m ago.*older than 15m freshness bar/i),
  ).toBeVisible();
  await expect(freshness.getByText(/schedule: stale.*schedule data warning/i)).toBeVisible();
  expect(matchupRequests).toBe(1);
});
