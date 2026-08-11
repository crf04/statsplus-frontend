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
  await expect(page.getByText(/Austin Reaves · 18% poss/)).toBeVisible();
  await expect(page.getByText(/LeBron James · 27% FGA/)).toBeVisible();
  await expect(page.getByText(/LeBron James · 36% FGA/)).toBeVisible();
  await expect(page.getByText(/LeBron James · 31% ast/)).toBeVisible();
  await expect(page.getByText(/Austin Reaves · 40% FGA/)).toHaveCount(0);
  await expect(page.getByText(/Austin Reaves · 35% ast/)).toHaveCount(0);
  await expect(page.getByText('15.2 per 48')).toBeVisible();
  await expect(page.getByText('2 targetable returned')).toBeVisible();
  await expect(page.getByRole('article', { name: 'LeBron James player' })).toBeVisible();
  await expect(
    page
      .getByRole('article', { name: 'LeBron James player' })
      .getByLabel('PTS from prizepicks, underdog'),
  ).toBeVisible();
  await expect(page.getByRole('article', { name: 'Maxi Kleber player' })).toHaveCount(0);
  await expect(page.getByText('Game-time decision')).toHaveCount(2);
  await expect(page.getByText('Maxi Kleber')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-desktop.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Last 15', exact: true }).click();
  await expect(
    page.getByText('Play types unavailable for Last 15: provider_unsupported.'),
  ).toBeVisible();
  await expect(page.getByText(/LeBron James · 19% poss/)).toHaveCount(0);
  await page.getByRole('button', { name: 'AST', exact: true }).click();
  await expect(
    page.getByText('Play types unavailable for Last 15: provider_unsupported.'),
  ).toHaveCount(0);
  await expect(page.getByText('Paint assists')).toBeVisible();
  await page.getByRole('button', { name: 'Season', exact: true }).click();

  await page.getByRole('button', { name: 'PTS' }).click();
  await expect(page.getByRole('article', { name: 'LeBron James player' })).toBeVisible();
  await expect(page.getByText(/Austin Reaves · 18% poss/)).toBeVisible();
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
  await expect(page.getByText(/Austin Reaves · 18% poss/)).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-fga-market.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'All deviations' }).click();
  await expect(page.getByText('0 rows hidden near league average.')).toBeVisible();

  await page.getByRole('button', { name: 'LAL defense' }).click();
  await expect(page.getByRole('heading', { name: 'LAL Defense Sheet' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Jayson Tatum player' })).toBeVisible();
  expect(matchupRequests).toHaveLength(1);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('matchup renders disabled injuries and unavailable surfaces without inventing data', async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await installApiContract(page, {
    '/api/games/matchup': {
      ...matchupPayload,
      players: [],
      injuries: {
        ...matchupPayload.injuries,
        status: 'unavailable',
        unavailable_reason: 'disabled',
        retrieved_at: null,
        teams: [],
      },
      freshness: {
        ...matchupPayload.freshness,
        pool: { status: 'unavailable', retrieved_at: null, providers: {} },
        stats: { status: 'stale', retrieved_at: '2026-01-13T10:00:00Z' },
        injuries: { status: 'unavailable', retrieved_at: null },
      },
    },
  });

  await page.goto('/matchups/0022500584');
  await expect(page.getByText(/pool: unavailable.*pool data warning/i)).toBeVisible();
  await expect(page.getByText(/stats: stale.*stats data warning/i)).toBeVisible();
  await expect(page.getByText('No posted players are available for this market.')).toBeVisible();
  await expect(page.getByText('Injury report unavailable: disabled.')).toBeVisible();
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-degraded.png'),
    fullPage: true,
  });
});

test('traditional unavailability has one market-relevant owner', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  const candidate = JSON.parse(JSON.stringify(matchupPayload));
  candidate.league.surface_availability.traditional.last_15 = {
    status: 'unavailable',
    unavailable_reason: 'not_stored',
  };
  candidate.league.defense_sheet.traditional.forEach((row) => {
    row.last_15 = null;
  });
  Object.values(candidate.league.defensive_columns).forEach((column) => {
    column.last_15 = null;
  });
  candidate.teams.forEach((team) => {
    team.defense_sheet.traditional.forEach((row) => {
      row.last_15 = null;
    });
    Object.values(team.defensive_columns).forEach((column) => {
      column.last_15 = null;
    });
  });
  await installApiContract(page, { '/api/games/matchup': candidate });
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('/matchups/0022500584');
  await page.getByRole('button', { name: 'Last 15', exact: true }).click();
  await expect(
    page.getByText('Traditional defense unavailable for Last 15: not_stored.'),
  ).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-traditional-unavailable.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'AST', exact: true }).click();
  await expect(
    page.getByText('Traditional defense unavailable for Last 15: not_stored.'),
  ).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('matchup keeps stale unmatched injury entries visible', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:30:00Z'));
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  const staleRetrievedAt = '2026-01-15T11:55:00Z';
  await installApiContract(page, {
    '/api/games/matchup': {
      ...matchupPayload,
      injuries: {
        ...matchupPayload.injuries,
        status: 'stale',
        retrieved_at: staleRetrievedAt,
      },
      freshness: {
        ...matchupPayload.freshness,
        injuries: { status: 'stale', retrieved_at: staleRetrievedAt },
      },
    },
  });
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('/matchups/0022500584');
  await expect(page.getByText(/injuries: stale.*injuries data warning/i)).toBeVisible();
  await expect(page.getByText('Gabe Vincent')).toBeVisible();
  await expect(page.getByText('Probable')).toBeVisible();
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-stale-injuries.png'),
    fullPage: true,
  });
});

test('matchup detail is usable at a narrow viewport with keyboard-only controls', async ({
  authenticatedPage: page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
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
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
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

test('@critical selection card supports selection, deep links, and tab flips without refetching', async ({
  authenticatedPage: page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  let selectionRequests = 0;
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/matchup/selection') selectionRequests += 1;
  });
  await page.goto('/matchups?date=2026-01-15');
  await page.getByRole('link', { name: 'Open Team Sheets' }).click();
  await expect(page).toHaveURL('/matchups/0022500584');
  await page.goto('/matchups/0022500584?context=kept');
  await page
    .getByRole('article', { name: 'LeBron James player' })
    .getByRole('button', { name: 'Open selection card' })
    .click();
  await expect(page).toHaveURL(/context=kept.*player=2544|player=2544.*context=kept/);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { name: 'LeBron James', level: 2 })).toBeVisible();
  await page
    .getByRole('article', { name: 'LeBron James player' })
    .getByRole('button', { name: 'Selected' })
    .click();
  const matrix = page.getByRole('table', { name: 'LeBron James Score Matrix' });
  await expect(matrix).toContainText('+12%');
  await expect(matrix).toContainText('thin');
  await expect(page.getByText('Thin sample — interpret cautiously.').first()).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'AVG' }).first()).toBeVisible();
  await expect(page.getByText(/displayed Season Diet Share inputs/)).toBeVisible();
  const postUpRow = page.locator('article.sheet-row').filter({ hasText: 'Post up' });
  await expect(postUpRow).not.toHaveClass(/selection-why/);
  await page.getByRole('button', { name: 'Last 15', exact: true }).click();
  await expect(postUpRow).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page
    .getByRole('group', { name: 'Selection log stat' })
    .getByRole('button', { name: 'PRA' })
    .click();
  await expect(page.getByRole('columnheader', { name: 'PRA' }).first()).toBeVisible();
  await expect(page.getByText('+0.102').first()).toBeVisible();
  expect(selectionRequests).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath('selection-card-desktop.png'),
    fullPage: true,
  });

  await page.goBack();
  await expect(page).toHaveURL('/matchups/0022500584?context=kept');
  await expect(page.getByRole('heading', { name: 'LeBron James', level: 2 })).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(/context=kept.*player=2544|player=2544.*context=kept/);
  await expect(page.getByRole('heading', { name: 'LeBron James', level: 2 })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'LeBron James', level: 2 })).toHaveCount(0);
  await expect(
    page.getByRole('article', { name: 'LeBron James player' }).getByRole('button'),
  ).toBeFocused();

  await page.goto('/matchups/0022500584?player=1630559');
  await expect(page.getByRole('heading', { name: 'Austin Reaves', level: 2 })).toBeVisible();
  await expect(page.getByText('No games vs this opponent data is available.')).toBeVisible();
  await expect(
    page.getByText('No score components were computable for FG3A in Season.'),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('selection-empty-thin.png'), fullPage: true });
  await page.goto('/matchups/0022500584?player=2544');
  await expect(page.getByRole('heading', { name: 'LeBron James', level: 2 })).toBeVisible();
  await page.setViewportSize({ width: 393, height: 852 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('selection-card-narrow.png'), fullPage: true });
});

test('selection clamps on an in-app player switch and leaves the team toggle operative', async ({
  authenticatedPage: page,
}, testInfo) => {
  let selectionRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/matchup/selection') selectionRequests += 1;
  });
  await page.goto('/matchups/0022500584');
  await page.getByRole('group', { name: 'Market' }).getByRole('button', { name: 'PTS' }).click();
  await page
    .getByRole('article', { name: 'LeBron James player' })
    .getByRole('button', { name: 'Open selection card' })
    .click();
  await page
    .getByRole('group', { name: 'Selection log stat' })
    .getByRole('button', { name: 'PRA' })
    .click();
  await expect(
    page.getByRole('group', { name: 'Selection log stat' }).getByRole('button', { name: 'PRA' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('group', { name: 'Market' }).getByRole('button', { name: 'PTS' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('columnheader', { name: 'PRA' }).first()).toBeVisible();
  expect(selectionRequests).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath('selection-sheet-pts-card-pra.png'),
    fullPage: true,
  });
  await page
    .getByRole('article', { name: 'Austin Reaves player' })
    .getByRole('button', { name: 'Open selection card' })
    .click();
  await expect(page.getByRole('heading', { name: 'Austin Reaves', level: 2 })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Selection log stat' }).getByRole('button', { name: 'PTS' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'LAL defense' }).click();
  await expect(page.getByRole('button', { name: 'LAL defense' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText(/not opposing the viewed Defense Sheet/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('selection-player-switch-team-toggle.png'),
    fullPage: true,
  });
});

test('selection request failure renders an honest handled error', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  await installApiContract(page, {
    '/api/games/matchup/selection': {
      status: 500,
      body: { error: { code: 'provider_unavailable' } },
    },
  });
  const failedResponses = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/matchups/0022500584?player=2544');
  await expect(page.getByRole('alert')).toContainText('Unable to load selection logs');
  await expect(page.getByText('Loading selection logs…')).toHaveCount(0);
  expect(failedResponses).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath('selection-error.png'), fullPage: true });
});
