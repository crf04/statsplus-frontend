import { setTargetThreshold } from '../fixtures/targetControls';
import {
  expect,
  HISTORICAL_GAME_ID,
  installApiContract,
  matchupPayload,
  test,
} from '../fixtures/courtai';

// --ct-gold, the colour the live header has always used for a data warning.
const WARNING_COLOUR = 'rgb(232, 163, 61)';

test('@critical a completed-season matchup reads as one sentence, a readable sheet and game-log players', async ({
  authenticatedPage: page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-04-02T12:00:00Z'));
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

  await page.goto(`/matchups/${HISTORICAL_GAME_ID}`);

  // Season defense renders even though the legacy stats marker is missing.
  const sheet = page.getByRole('region', { name: 'What MIL allows' });
  await expect(page.getByRole('heading', { name: 'What MIL allows' })).toBeVisible();
  await expect(sheet).toContainText(
    'Compared with the league average, softest spots first. 1 close to average hidden.',
  );
  await expect(page.getByText('Defense Sheet unavailable because stats are missing.')).toHaveCount(
    0,
  );

  // One sentence replaces the provenance block: when, what it is built on,
  // and what this game does not have.
  await expect(page.getByText('Matchup', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Matchup summary' })).toHaveText(
    /^\w{3}, Mar (29|30), 2026 · Final\. Full-season defense ranks; no Last 15 or injury report\.$/,
  );
  await expect(page.getByText(/provenance/i)).toHaveCount(0);
  await expect(page.getByText(/Completed-season context/)).toHaveCount(0);
  await expect(page.getByText(/Tap a player/)).toHaveCount(0);
  await expect(page.getByText(/data warning|stale/i)).toHaveCount(0);
  const last15 = page.getByRole('button', { name: 'Last 15', exact: true });
  await expect(last15).toBeDisabled();
  await expect(last15).toHaveAttribute(
    'title',
    'No point-in-time snapshot was captured for this game.',
  );
  await expect(
    page.getByText('No pregame injury snapshot was archived for this game.'),
  ).toHaveCount(0);

  // The rail is Players in game, drawn from the opposing side's game logs, one
  // stat at a time: points, what each did, against his season average.
  const categories = page.getByRole('group', { name: 'Stat category' });
  await expect(categories.getByRole('button', { name: 'PTS', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const rail = page.getByRole('complementary', { name: 'Players in game' });
  await expect(rail.getByRole('heading', { level: 2 })).toHaveText('LAC · PTS');
  await expect(rail.getByRole('article', { name: /player$/ })).toHaveText([
    /^Kawhi Leonard35 min · \+2\.6 vs his season average24PTS$/,
    /^James Harden36 min · −0\.8 vs his season average19PTS$/,
    /^Ivica Zubac28 min · −2\.1 vs his season average10PTS$/,
  ]);
  await expect(rail.getByRole('article', { name: 'Giannis Antetokounmpo player' })).toHaveCount(0);
  await expect(page.getByText('Targetable players')).toHaveCount(0);
  await expect(page.getByText(/targetable returned/)).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Market' })).toHaveCount(0);

  // Points read Play types only, softest first, with who leans on each.
  await expect(sheet.getByRole('article')).toHaveText([/^Post up/, /^Transition/]);
  await expect(page.getByRole('list', { name: 'Players leaning on Transition' })).toHaveText(
    'Kawhi Leonard 22%',
  );
  await page.screenshot({
    path: testInfo.outputPath('historical-matchup-desktop.png'),
    fullPage: true,
  });

  // On All the sheet reads every category in plain English; the rail still
  // reads points.
  await categories.getByRole('button', { name: 'All', exact: true }).click();
  await expect(rail.getByRole('heading', { level: 2 })).toHaveText('LAC · PTS');
  await expect(sheet.getByRole('article')).toHaveText([
    /^Post up/,
    /^Transition/,
    /^Catch-and-shoot 3s/,
    /^Restricted area/,
    /^Above-the-break 3s/,
    /^At the rim/,
    /^Turnovers forced/,
    /^Blocks/,
    /^Rebounds/,
    /^Steals/,
    /^OREB off 2PT misses/,
    /^DREB off 3PT misses/,
    /^DREB off FT misses/,
    /^DREB off 2PT misses/,
    /^OREB off FT misses/,
    /^OREB off 3PT misses/,
  ]);
  await expect(page.getByRole('list', { name: 'Players leaning on At the rim' })).toHaveText(
    'James Harden 38%Kawhi Leonard 30%',
  );
  await expect(
    page.getByRole('list', { name: 'Players leaning on Above-the-break 3s' }),
  ).toHaveText('James Harden 31%');
  await expect(
    page.getByRole('list', { name: 'Players leaning on Catch-and-shoot 3s' }),
  ).toHaveText('Kawhi Leonard 32%');
  await categories.getByRole('button', { name: 'FG3A', exact: true }).click();
  await expect(rail.getByRole('article', { name: 'James Harden player' })).toContainText('9FG3A');
  await categories.getByRole('button', { name: 'PTS', exact: true }).click();

  // Switching the defense team switches the opposing participant rail.
  await page.getByRole('button', { name: 'LAC defense' }).click();
  await expect(page.getByRole('heading', { name: 'What LAC allows' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Giannis Antetokounmpo player' })).toHaveText(
    /^Giannis Antetokounmpo35 min · \+2\.8 vs his season average33PTS$/,
  );
  await expect(page.getByRole('article', { name: 'Damian Lillard player' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Kawhi Leonard player' })).toHaveCount(0);
  await page.getByRole('button', { name: 'MIL defense' }).click();

  // Selecting a game-log participant opens the stored-data dossier.
  await page
    .getByRole('article', { name: 'Kawhi Leonard player' })
    .getByRole('button', { name: 'Open selection card' })
    .click();
  await expect(page).toHaveURL(new RegExp(`player=202695`));
  await expect(page.getByRole('heading', { name: 'Kawhi Leonard', level: 2 })).toBeVisible();
  await expect(page.getByText('LAC @ MIL, 2026-03-29.')).toBeVisible();
  const strip = page.getByRole('group', { name: 'Selection log stat' });
  await expect(strip).toContainText('34.5');
  await expect(strip.getByRole('button', { name: 'PTS' })).toContainText('24.0');
  await expect(strip.getByRole('button', { name: 'REB' })).toContainText('5.0');
  await expect(strip.getByRole('button', { name: 'AST' })).toContainText('7.0');
  await expect(page.getByText(/vs MIL, \d+ games? before this one/)).toBeVisible();
  await expect(page.getByText('Thin sample — interpret cautiously.')).toBeVisible();
  await expect(page.getByText(/hindsight/)).toHaveCount(0);
  await expect(page.getByText('Archetype sample')).toHaveCount(0);
  await expect(page.getByText('The Score Matrix reflects completed-season context.')).toBeVisible();
  const matrix = page.getByRole('table', { name: 'Kawhi Leonard Score Matrix' });
  await expect(matrix.getByRole('columnheader', { name: 'Category' })).toBeVisible();
  await expect(matrix.getByRole('columnheader', { name: 'Market' })).toHaveCount(0);
  await expect(page.getByRole('rowheader', { name: '2026-01-12 · LAC vs. MIL' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: /2026-03-29/ })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('historical-selection-card.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'What MIL allows' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath('historical-matchup-narrow.png'),
    fullPage: true,
  });

  expect(matchupRequests).toHaveLength(1);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('matchup detail preserves the approved Open Team Sheets hierarchy', async ({
  authenticatedPage: page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.goto('/matchups/0022500584');

  const rail = page.getByRole('complementary', { name: 'Targetable players' });
  const sheet = page.getByRole('region', { name: 'What BOS allows' });
  const controls = page.getByRole('region', { name: 'Defense Sheet controls' });
  await expect(rail).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(controls).toBeVisible();

  const [railBox, sheetBox, controlsBox] = await Promise.all([
    rail.boundingBox(),
    sheet.boundingBox(),
    controls.boundingBox(),
  ]);
  expect(railBox.x).toBeLessThan(sheetBox.x);
  expect(controlsBox.x).toBeGreaterThanOrEqual(sheetBox.x);
  expect(sheetBox.width).toBeGreaterThan(railBox.width * 2);

  // On a desktop the categories flow in two columns.
  await page.getByRole('group', { name: 'Market' }).getByRole('button', { name: 'All' }).click();
  const columns = new Set();
  for (const region of await sheet.getByRole('region').all()) {
    columns.add(Math.round((await region.boundingBox()).x));
  }
  expect(columns.size).toBe(2);
});

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
  const sheet = page.getByRole('region', { name: 'What BOS allows' });
  await expect(page.getByRole('heading', { name: 'What BOS allows' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Matchup summary' })).toHaveText(
    /^\w{3}, Jan 1[56], 2026 · Tip-off \d{1,2}:30\s[AP]M\. Lines from PrizePicks\.$/,
  );

  // The page opens on PTS: the rail leads with each player's posted line, or
  // his Matchup Score where no book has numbered him.
  const market = page.getByRole('group', { name: 'Market' });
  await expect(market.getByRole('button', { name: 'PTS' })).toHaveAttribute('aria-pressed', 'true');
  const rail = page.getByRole('complementary', { name: 'Targetable players' });
  await expect(rail).toContainText('By season scoring · 2 targetable returned');
  const lebron = rail.getByRole('article', { name: 'LeBron James player' });
  await expect(lebron).toContainText('27.5market line · 25.4 avg');
  await expect(
    lebron.getByLabel(
      'PTS posted by PrizePicks, Underdog at 26.5, 1 lower than the market and Polymarket',
    ),
  ).toHaveText('PPUD −1PM');
  await expect(lebron.getByText('Lines disagree')).toHaveCount(1);
  const austin = rail.getByRole('article', { name: 'Austin Reaves player' });
  await expect(austin).toContainText('+24%Matchup Score');
  await expect(austin.getByText('Game-time decision')).toBeVisible();
  await expect(rail.getByRole('article', { name: /player$/ })).toHaveText([
    /^LeBron James/,
    /^Austin Reaves/,
  ]);
  await expect(page.getByRole('article', { name: 'Maxi Kleber player' })).toHaveCount(0);
  await expect(page.getByText('Maxi Kleber')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Matchup Score' })).toHaveCount(0);

  await expect(sheet).toContainText(
    'Compared with the league average, softest spots first. 1 close to average hidden.',
  );
  await expect(sheet.getByRole('article')).toHaveText([/^Transition\+12%/, /^Post up\+10%/]);
  await expect(page.getByRole('list', { name: 'Players leaning on Transition' })).toHaveText(
    'LeBron James 19%Austin Reaves 18%',
  );
  await expect(page.getByRole('list', { name: 'Players leaning on Post up' })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-desktop.png'),
    fullPage: true,
  });

  // A stat only PrizePicks numbers him in.
  await market.getByRole('button', { name: 'REB' }).click();
  await expect(lebron).toContainText('7.5line');
  await expect(lebron.getByLabel('REB posted by PrizePicks')).toHaveText('PP');
  await expect(sheet.getByRole('heading', { level: 3, name: 'Rebound Types' })).toBeVisible();
  await expect(
    sheet.getByRole('article', { name: 'OREB off 2PT misses' }).getByTitle(/rank 27 of 30/),
  ).toContainText('+14%');
  await expect(
    page.getByRole('list', { name: 'Players leaning on OREB off 2PT misses' }),
  ).toHaveText('LeBron James 12%');
  await expect(sheet.getByRole('button', { name: /Save OREB .* as a Target/ })).toHaveCount(0);
  await market.getByRole('button', { name: 'PTS' }).click();
  await expect(sheet.getByRole('heading', { level: 3, name: 'Rebound Types' })).toHaveCount(0);
  await market.getByRole('button', { name: 'REB' }).click();

  await market.getByRole('button', { name: 'All' }).click();
  await expect(sheet.getByRole('heading', { level: 3 })).toHaveText([
    'Play types',
    'Shot types',
    'Shot zones',
    'Assists by location',
    'Box score',
    'Rebound Types',
  ]);
  await expect(sheet.getByRole('article')).toHaveText([
    /^Transition/,
    /^Post up/,
    /^Catch-and-shoot 3s/,
    /^Restricted area/,
    /^Above-the-break 3s/,
    /^At the rim/,
    /^Turnovers forced/,
    /^Blocks/,
    /^Rebounds/,
    /^Steals/,
    /^OREB off 2PT misses/,
    /^DREB off 3PT misses/,
    /^DREB off FT misses/,
    /^DREB off 2PT misses/,
    /^OREB off FT misses/,
    /^OREB off 3PT misses/,
  ]);
  await expect(page.getByText(/OPP|Backcourt|Arc3|AtRim/)).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Players leaning on Restricted area' })).toHaveText(
    'LeBron James 27%Austin Reaves 25%',
  );
  await expect(page.getByRole('list', { name: 'Players leaning on At the rim' })).toHaveText(
    'LeBron James 31%',
  );
  await expect(
    sheet.getByRole('article', { name: 'Transition' }).getByRole('img'),
  ).toHaveAccessibleName('Rank 27 of 30: allows the 4th most');
  await expect(
    sheet.getByTitle('18.4 per 48 · +1.4σ · rank 27 of 30 (30 allows the most)'),
  ).toContainText('+12%');

  await page.getByRole('button', { name: 'Last 15', exact: true }).click();
  await expect(
    page.getByText('Play types unavailable for Last 15: provider_unsupported.'),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Shot types unavailable for Last 15: Last 15 has not opened yet; it opens once every team has played 15 games.',
    ),
  ).toBeVisible();
  await expect(page.getByText(/window_not_ready/)).toHaveCount(0);
  await expect(page.getByText('Opponent rebounds unavailable for Last 15.')).toBeVisible();
  await expect(sheet.getByRole('article', { name: 'Turnovers forced' })).toBeVisible();
  await expect(page.getByText('No Defense Sheet rows match these controls.')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-legacy-traditional.png'),
    fullPage: true,
  });
  await market.getByRole('button', { name: 'REB' }).click();
  await expect(page.getByText('Opponent rebounds unavailable for Last 15.')).toBeVisible();
  await expect(page.getByText('No Defense Sheet rows match these controls.')).toHaveCount(0);
  await market.getByRole('button', { name: 'AST' }).click();
  await expect(
    page.getByText('Play types unavailable for Last 15: provider_unsupported.'),
  ).toHaveCount(0);
  await expect(sheet.getByRole('article', { name: 'At the rim' })).toBeVisible();
  await page.getByRole('button', { name: 'Season', exact: true }).click();

  await market.getByRole('button', { name: 'TOV' }).click();
  await expect(sheet.getByRole('article')).toHaveText([/^Turnovers forced/]);

  // Attempts and makes sit side by side; the measure outside the stat dims.
  await market.getByRole('button', { name: 'FG2A' }).click();
  await expect(sheet.getByRole('article')).toHaveText([/^Restricted area/]);
  await market.getByRole('button', { name: 'FG3A' }).click();
  await expect(sheet.getByRole('article')).toHaveText([
    /^Catch-and-shoot 3s/,
    /^Above-the-break 3s/,
  ]);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-real-market-split.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'All deviations' }).click();
  await expect(sheet).toContainText('Compared with the league average, softest spots first.');
  await expect(sheet).not.toContainText('close to average hidden');

  await page.getByRole('button', { name: 'LAL defense' }).click();
  await expect(page.getByRole('heading', { name: 'What LAL allows' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Jayson Tatum player' })).toBeVisible();
  expect(matchupRequests).toHaveLength(1);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('preseason matchups show a clear limited-sample caveat', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  const candidate = JSON.parse(JSON.stringify(matchupPayload));
  candidate.game.preseason = true;
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await installApiContract(page, { '/api/games/matchup': candidate });

  await page.goto('/matchups/0022500584');
  await expect(page.getByRole('note', { name: 'Preseason matchup caveat' })).toContainText(
    'Preseason matchup — current-season samples may be limited.',
  );
  await expect(
    page.getByText('Preseason matchup — current-season samples may be limited.'),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-preseason.png'),
    fullPage: true,
  });
});

test('null relative percentages stay neutral when the matching league average is zero', async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  const candidate = JSON.parse(JSON.stringify(matchupPayload));
  candidate.league.defense_sheet.play_types[0].season.average_allowed_per_48 = 0;
  candidate.teams.find((team) => team.tricode === 'BOS').defense_sheet.play_types[0].season = {
    allowed_per_48: 7.5,
    percent_vs_league_average: null,
    sigma_deviation: 1.4,
    rank: 1,
  };
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await installApiContract(page, { '/api/games/matchup': candidate });

  await page.goto('/matchups/0022500584');
  await page.getByRole('button', { name: 'All deviations', exact: true }).click();
  const transition = page.getByRole('article', { name: 'Transition' });
  await expect(
    transition.getByTitle(
      '7.5 per 48 · +1.4σ · rank 1 of 30 (30 allows the most) · vs league: unavailable (not comparable)',
    ),
  ).toHaveText('—1');
  await expect(page.getByText(/null%/)).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-neutral-relative.png'),
    fullPage: true,
  });
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
  const summary = page.getByRole('region', { name: 'Matchup summary' });
  // Missing lines say so once; the stale stats and absent report go unsaid.
  await expect(summary).toHaveText(/ · Tip-off .*\. No lines posted yet\.$/);
  await expect(summary.locator('.matchup-warning')).toHaveCount(0);
  await expect(page.getByText('No posted players are available for this market.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Injury Report' })).toHaveCount(0);
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
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: 'Last 15', exact: true }).click();
  await expect(page.getByText('Box score unavailable for Last 15: not_stored.')).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-traditional-unavailable.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'AST', exact: true }).click();
  await expect(page.getByText('Box score unavailable for Last 15: not_stored.')).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('explains a withheld Last-15 window in a sentence instead of a raw reason', async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  const candidate = JSON.parse(JSON.stringify(matchupPayload));
  candidate.league.surface_availability.traditional.last_15 = {
    status: 'unavailable',
    unavailable_reason: 'insufficient_governed_games',
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
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/matchups/0022500584');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: 'Last 15', exact: true }).click();
  await expect(
    page.getByText(
      'Box score unavailable for Last 15: Last 15 has not opened yet; it opens once every team has played 15 games.',
    ),
  ).toHaveCount(1);
  await expect(page.getByText(/insufficient_governed_games/)).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-last15-withheld.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Season', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Turnovers forced' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/matchups/0022500584');
  await expect(page.getByRole('heading', { name: 'What BOS allows' })).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).focus();
  await expect(page.getByRole('button', { name: 'All', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'PTS', exact: true })).toBeFocused();
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
  await expect(page.getByRole('heading', { name: 'What BOS allows' })).toBeVisible();
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
        // Underdog is read as often as the pool, one minute before the clock starts; PrizePicks
        // was read at 11:50 and hourly, so the backend keeps it fresh for 90 minutes.
        pool: {
          ...matchupPayload.freshness.pool,
          providers: {
            ...matchupPayload.freshness.pool.providers,
            underdog: { status: 'fresh', retrieved_at: '2026-01-15T11:59:00Z' },
          },
        },
      },
    },
  });
  let matchupRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/matchup') matchupRequests += 1;
  });
  await page.goto('/matchups/0022500584');
  const summary = page.getByRole('region', { name: 'Matchup summary' });
  await expect(summary).toContainText('Lines from PrizePicks and Underdog.');
  await expect(summary.locator('.matchup-warning')).toHaveCount(0);

  // 12:31: Underdog (read 12:00 minus one minute) is past 15m and warns with its own age; PrizePicks,
  // read 41 minutes ago, is inside its 90 and does not set the age. The schedule crossing 30h stays unsaid.
  await page.clock.runFor(31 * 60 * 1000);
  await expect(summary.getByText('Lines last read 32m ago.')).toHaveCSS('color', WARNING_COLOUR);
  await expect(summary).not.toContainText('41m');
  await expect(summary).not.toContainText('Schedule');

  // 13:21: PrizePicks is 91 minutes old, and now the oldest line that warns.
  await page.clock.runFor(50 * 60 * 1000);
  await expect(summary.getByText('Lines last read 2h ago.')).toHaveCSS('color', WARNING_COLOUR);
  expect(matchupRequests).toBe(1);
});

test('a matchup pool only PrizePicks has read holds its 90 minute bar without refetching', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-01-15T12:00:00Z') });
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  // The fixture's pool names PrizePicks alone, read at 11:50.
  await installApiContract(page);
  let matchupRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/games/matchup') matchupRequests += 1;
  });
  await page.goto('/matchups/0022500584');
  const summary = page.getByRole('region', { name: 'Matchup summary' });
  await expect(summary).toContainText('Lines from PrizePicks.');

  // 12:41: the only provider is 51 minutes old, past 15 and inside 90.
  await page.clock.runFor(41 * 60 * 1000);
  await expect(summary.locator('.matchup-warning')).toHaveCount(0);

  // 13:21: 91 minutes old.
  await page.clock.runFor(40 * 60 * 1000);
  await expect(summary.getByText('Lines last read 2h ago.')).toHaveCSS('color', WARNING_COLOUR);
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
  const sheetPts = page.getByRole('group', { name: 'Market' }).getByRole('button', { name: 'PTS' });
  await expect(sheetPts).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'LeBron James', level: 2 })).toBeVisible();
  await page
    .getByRole('article', { name: 'LeBron James player' })
    .getByRole('button', { name: 'Selected' })
    .click();
  const matrix = page.getByRole('table', { name: 'LeBron James Score Matrix' });
  await expect(matrix).toContainText('+12%');
  await expect(matrix).toContainText('thin');
  // Only the Archetype sample was thin here, and it no longer renders.
  await expect(page.getByText('Thin sample — interpret cautiously.')).toHaveCount(0);
  await expect(page.getByText(/PTS avg/)).toBeVisible();
  await expect(page.getByText(/displayed Season Diet Share inputs/)).toBeVisible();
  // The slices his diet leans on are the ones the card points at.
  const transition = page.getByRole('article', { name: 'Transition' });
  await expect(transition).toContainText('LeBron James 19%');
  await expect(page.getByRole('article', { name: 'Post up' })).toBeVisible();
  await page.getByRole('button', { name: 'Last 15', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Post up' })).toHaveCount(0);
  await expect(sheetPts).toHaveAttribute('aria-pressed', 'true');
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

/*
 * Capture is why a Defense Sheet row is worth reading twice: the row is the
 * evidence and the Target is the filter it implies. One journey follows that
 * from the row to the card the Targets page then holds, so the prefill, the
 * derived title, and the duplicate rule are all proved against the contract
 * rather than against the page's own idea of them.
 */
test('@critical a Defense Sheet row becomes a Target the Targets page then holds', async ({
  authenticatedPage: page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  // A Qualifier is written on the wire, not on the screen, so the journey reads
  // the bodies the page actually posted rather than only the titles they earned.
  const created = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/user/targets' && request.method() === 'POST')
      created.push(request.postDataJSON());
  });
  await installApiContract(page);
  await page.goto('/matchups/0022500584');
  await expect(page.getByRole('heading', { name: 'What BOS allows' })).toBeVisible();

  // Shot-zone attempts read on All rather than the opening PTS tab.
  const allStats = page.getByRole('group', { name: 'Market' }).getByRole('button', { name: 'All' });
  await allStats.click();
  const rowAction = page.getByRole('button', { name: 'Save Restricted area as a Target' });
  // The save icon waits at the row's end until the row is hovered.
  await expect(rowAction).toHaveCSS('opacity', '0');
  await page.getByRole('article', { name: 'Restricted area' }).hover();
  await expect(rowAction).toHaveCSS('opacity', '1');
  await rowAction.click();

  // BOS owns the sheet, so BOS is the opponent and it is not up for editing.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Opponent', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Opponent', exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Qualifier 1 diet base')).toHaveValue('shot_zones');
  await expect(dialog.getByLabel('Qualifier 1 slice')).toHaveValue('Restricted Area');
  await expect(
    dialog.getByRole('button', { name: 'At or above; switch to at or below' }),
  ).toBeVisible();
  // 20% is the league average this row is already being read against.
  await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('20');
  await expect(dialog.getByText('BOS vs Restricted area ≥ 20%')).toBeVisible();
  // The Lab reads the prefilled draft beneath the form: BOS plays tonight and
  // nobody qualifying has faced them yet.
  await expect(dialog.getByText(/fit tonight vs BOS/)).toBeVisible();
  await expect(dialog.getByText('Nobody qualifying has faced BOS yet.')).toBeVisible();
  // The dialog is fixed to the viewport, so a full-page capture would show the
  // page it floats over; its fade is finished rather than waited out.
  await page.screenshot({
    path: testInfo.outputPath('matchup-capture.png'),
    animations: 'disabled',
  });

  // Closing hands the keyboard back to the row the capture started from.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(rowAction).toBeFocused();

  // The prefill is a starting point: the threshold is the reader's to move.
  await rowAction.click();
  await setTargetThreshold(dialog, 26);
  await dialog.getByLabel('Why · optional').fill('Rim leaks against big lineups.');
  await dialog.getByRole('button', { name: 'Save Target' }).click();

  // The saved draft is the record, and opens on its own page under the title
  // the backend derived and stored.
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await expect(page.getByRole('heading', { name: 'BOS vs Restricted area ≥ 26%' })).toBeVisible();
  expect(created).toEqual([
    {
      opponent: 'BOS',
      note: 'Rim leaks against big lineups.',
      qualifiers: [
        {
          base: 'shot_zones',
          slice_key: 'Restricted Area',
          comparator: 'at_or_above',
          threshold: 0.26,
        },
      ],
    },
  ]);

  // The same row saved again is the duplicate the account already holds.
  await page.goto('/matchups/0022500584');
  await allStats.click();
  await rowAction.click();
  await setTargetThreshold(dialog, 26);
  await dialog.getByRole('button', { name: 'Save Target' }).click();
  await expect(dialog.getByRole('alert')).toContainText('You already have that Target for BOS.');
  await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('26');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A slice on a different base captures just as readily. Its league average is
  // 9.25%, so the prefill is the whole percent rather than the raw share, and
  // the backend spells this slice differently from the page: the confirmation
  // and the card both have to read the stored title, not the local preview.
  await page.getByRole('button', { name: 'Save Transition as a Target' }).click();
  await expect(dialog.getByLabel('Qualifier 1 diet base')).toHaveValue('play_types');
  await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('9');
  await expect(dialog.getByText('BOS vs Transition ≥ 9%')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Target' }).click();
  await expect(page).toHaveURL(/\/targets\/\d+$/);
  await expect(page.getByRole('heading', { name: 'BOS vs Transition offense ≥ 9%' })).toBeVisible();
  expect(created[created.length - 1]).toEqual({
    opponent: 'BOS',
    note: '',
    qualifiers: [
      {
        base: 'play_types',
        slice_key: 'Transition',
        comparator: 'at_or_above',
        threshold: 0.09,
      },
    ],
  });
  await page.getByRole('link', { name: '← All Targets' }).click();

  await expect(page).toHaveURL('/targets');
  await expect(page.getByText('2 Targets active today')).toBeVisible();
  const card = page.getByRole('article', { name: 'BOS vs Restricted area ≥ 26%' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Rim leaks against big lineups.');
  await expect(page.getByRole('article', { name: 'BOS vs Transition offense ≥ 9%' })).toBeVisible();
});

test('capture stays reachable and the sheet stays unscrolled at a phone width', async ({
  authenticatedPage: page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiContract(page);
  await page.goto('/matchups/0022500584');
  await expect(page.getByRole('heading', { name: 'What BOS allows' })).toBeVisible();

  await page.getByRole('group', { name: 'Market' }).getByRole('button', { name: 'All' }).click();
  const save = page.getByRole('button', { name: 'Save Restricted area as a Target' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await save.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('20');
  await expect(dialog.getByText(/fit tonight vs BOS/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('matchup-capture-narrow.png'),
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

/*
 * What the sheet looks like is CSS, which jsdom does not apply, so these read
 * computed styles in the browser (crf04/statsplus#179 AC 9, 13, 15, 17, 18).
 */
const withMakesBesideAttempts = () => {
  const candidate = JSON.parse(JSON.stringify(matchupPayload));
  candidate.teams
    .find((team) => team.tricode === 'BOS')
    .defense_sheet.shot_zones.push({
      key: 'Restricted Area:FGM',
      label: 'Restricted Area FGM',
      markets: ['PTS', 'PA', 'PR', 'PRA'],
      season: { allowed_per_48: 14, percent_vs_league_average: 6, sigma_deviation: 1.2, rank: 22 },
      last_15: { allowed_per_48: 13, percent_vs_league_average: 4, sigma_deviation: 1.1, rank: 20 },
    });
  candidate.league.defense_sheet.shot_zones.push({
    key: 'Restricted Area:FGM',
    season: { average_allowed_per_48: 13.2, sigma: 1 },
    last_15: { average_allowed_per_48: 12.5, sigma: 1 },
  });
  return candidate;
};

test('the sheet shows both measures at full strength, draws no category boxes and reads at the larger type', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  await installApiContract(page, { '/api/games/matchup': withMakesBesideAttempts() });
  await page.goto('/matchups/0022500584');

  // On PTS the makes are in the stat; the attempts beside them are not, and read just as strongly.
  const restricted = page.getByRole('article', { name: 'Restricted area' });
  await expect(restricted.getByTitle(/per 48/)).toHaveCount(2);
  const [attempts, makes] = await restricted.getByTitle(/per 48/).all();
  const opacity = async (locator) =>
    Number(await locator.evaluate((node) => getComputedStyle(node).opacity));
  expect(await opacity(attempts)).toBe(1);
  expect(await opacity(makes)).toBe(1);

  // A category is a label and a rule, not a box.
  const category = page.getByRole('region', { name: 'Shot zones' });
  const box = await category.evaluate((node) => {
    const style = getComputedStyle(node);
    return [
      style.borderTopWidth,
      style.borderRightWidth,
      style.borderBottomWidth,
      style.borderLeftWidth,
      style.backgroundColor,
    ];
  });
  expect(box).toEqual(['0px', '0px', '0px', '0px', 'rgba(0, 0, 0, 0)']);

  // Body text is at least 15% larger than on master, where the rail note and
  // an injury entry were both 0.68rem (10.88px).
  const fontSize = async (locator) =>
    Number.parseFloat(await locator.evaluate((node) => getComputedStyle(node).fontSize));
  expect(await fontSize(page.getByText(/^By season scoring/))).toBeGreaterThanOrEqual(10.88 * 1.15);
  expect(await fontSize(page.getByText('Left calf soreness'))).toBeGreaterThanOrEqual(10.88 * 1.15);
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('the save icon shows without hover and the page does not scroll sideways', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
    await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
    await installApiContract(page, { '/api/games/matchup': withMakesBesideAttempts() });
    await page.goto('/matchups/0022500584');

    expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
    const save = page.getByRole('button', { name: 'Save Restricted area as a Target' });
    const opacity = Number(await save.evaluate((node) => getComputedStyle(node).opacity));
    expect(opacity).toBeGreaterThan(0.5);
    for (const stat of ['PTS', 'All']) {
      await page.getByRole('group', { name: 'Market' }).getByRole('button', { name: stat }).tap();
      // A mobile browser widens its layout viewport to fit overflow, so the
      // page is held to the 390 px screen itself rather than to innerWidth.
      const widths = await page.evaluate(() => [
        window.innerWidth,
        document.documentElement.scrollWidth,
      ]);
      expect(widths).toEqual([390, 390]);
    }
  });
});

test('a rank marker sits along its fewest-to-most track by rank', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-01-15T12:00:00Z'));
  await page.addInitScript(() => localStorage.setItem('courtai:e2e-authenticated', 'true'));
  await installApiContract(page);
  await page.goto('/matchups/0022500584');
  await page.getByRole('group', { name: 'Market' }).getByRole('button', { name: 'All' }).click();

  // Rank 1 is the track's left end and rank 30 its right end.
  for (const [slice, rank] of [
    ['Above-the-break 3s', 3],
    ['At the rim', 28],
  ]) {
    const track = page.getByRole('article', { name: slice }).getByRole('img');
    await expect(track).toHaveAccessibleName(new RegExp(`^Rank ${rank} of 30`));
    const [trackBox, markerBox] = await Promise.all([
      track.boundingBox(),
      track.locator('i').boundingBox(),
    ]);
    const centre = markerBox.x + markerBox.width / 2;
    const expected = trackBox.x + ((rank - 1) / 29) * trackBox.width;
    expect(Math.abs(centre - expected)).toBeLessThan(2);
  }
});
