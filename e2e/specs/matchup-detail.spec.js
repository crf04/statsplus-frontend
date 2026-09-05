import {
  expect,
  HISTORICAL_GAME_ID,
  installApiContract,
  matchupPayload,
  test,
} from '../fixtures/courtai';

test('@critical a completed-season matchup renders section-owned evidence and game-log players', async ({
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
  await expect(page.getByRole('heading', { name: 'MIL Defense Sheet' })).toBeVisible();
  await expect(page.getByText('Transition PTS')).toBeVisible();
  await expect(page.getByText('Restricted Area FGA')).toBeVisible();
  await expect(page.getByText('Above the Break 3 FGA')).toBeVisible();
  await expect(page.getByText('Defense Sheet unavailable because stats are missing.')).toHaveCount(
    0,
  );

  // Section-owned statuses replace the generic Pool/Stats freshness warnings.
  const evidence = page.getByRole('region', { name: 'Historical matchup evidence' });
  await expect(evidence).toBeVisible();
  await expect(page.getByRole('region', { name: 'Matchup data freshness' })).toHaveCount(0);
  await expect(evidence).toContainText(
    'Schedule: Completed-season catalog · from Event Catalog · collected 2026-03-30',
  );
  await expect(evidence).toContainText('Participants: Completed-season context · from game logs');
  await expect(evidence).toContainText(
    'Season defense: Completed-season context · from Defense Sheet publication',
  );
  await expect(evidence).toContainText(
    'Last 15 defense: unavailable — No point-in-time snapshot was captured for this game.',
  );
  await expect(page.getByText(/pool data warning/i)).toHaveCount(0);
  await expect(page.getByText(/stats data warning/i)).toHaveCount(0);

  await expect(
    page.getByText(
      'Season defense provenance: Completed-season context · Defense Sheet publication',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Last 15', exact: true })).toBeDisabled();
  await expect(
    page.getByText('No point-in-time snapshot was captured for this game.').last(),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Injuries' })
      .getByText('No pregame injury snapshot was archived for this game.'),
  ).toBeVisible();

  // The rail is Players in game, drawn from the opposing side's game logs.
  const rail = page.getByRole('complementary', { name: 'Players in game' });
  await expect(rail.getByRole('article', { name: 'Kawhi Leonard player' })).toBeVisible();
  await expect(rail.getByRole('article', { name: 'James Harden player' })).toBeVisible();
  await expect(rail.getByRole('article', { name: 'Ivica Zubac player' })).toBeVisible();
  await expect(rail.getByRole('article', { name: 'Giannis Antetokounmpo player' })).toHaveCount(0);
  await expect(page.getByText('Targetable players')).toHaveCount(0);
  await expect(page.getByText(/targetable returned/)).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Kawhi Leonard posted markets' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Market' })).toHaveCount(0);

  // The focal outcome and the completed-season baseline stay distinguishable.
  await expect(
    rail
      .getByRole('article', { name: 'Kawhi Leonard player' })
      .getByText('Focal game LAC @ MIL · 34.5 MIN · 24.0 PTS · 5.0 REB · 7.0 AST'),
  ).toBeVisible();
  await expect(page.getByText('21.4 PPG · completed-season context')).toBeVisible();
  await expect(page.getByText('Kawhi Leonard · 22% poss · +1.3σ')).toBeVisible();
  await expect(page.getByText('Kawhi Leonard · 28% FGA · +1.2σ')).toBeVisible();
  await expect(page.getByText('James Harden · 31% FGA · +1.3σ')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('historical-matchup-desktop.png'),
    fullPage: true,
  });

  // Governed Stat Categories, not posted DFS markets, drive the control.
  const categories = page.getByRole('group', { name: 'Stat category' });
  await expect(categories).toBeVisible();
  await expect(categories.getByRole('button', { name: 'FG3A', exact: true })).toBeVisible();
  await categories.getByRole('button', { name: 'PTS', exact: true }).click();
  await expect(page.getByText('Transition PTS')).toBeVisible();
  await expect(page.getByText('Above the Break 3 FGA')).toHaveCount(0);

  // Season scoring order, then Matchup Score order, with unavailable last.
  let players = page.getByRole('article', { name: /player$/ });
  await expect(players.first()).toHaveAccessibleName('Kawhi Leonard player');
  await page.getByRole('button', { name: 'Matchup Score' }).click();
  players = page.getByRole('article', { name: /player$/ });
  await expect(players.first()).toHaveAccessibleName('James Harden player');
  await expect(players.last()).toHaveAccessibleName('Ivica Zubac player');
  await expect(
    page.getByRole('heading', { name: 'PTS Matchup Score order · completed-season context' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'PTS Matchup Score unavailable: missing team_defense:play_types, player_diet:shot_zones.',
    ),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('historical-matchup-score-sort.png'),
    fullPage: true,
  });

  // A withheld defensive score still ships component evidence. That component
  // must not be promoted into an available score or an ordering position.
  await categories.getByRole('button', { name: 'TOV', exact: true }).click();
  await expect(
    page.getByText('TOV Matchup Score unavailable: missing team_defense:traditional.'),
  ).toBeVisible();
  players = page.getByRole('article', { name: /player$/ });
  await expect(players.last()).toHaveAccessibleName('Ivica Zubac player');
  await categories.getByRole('button', { name: 'PTS', exact: true }).click();

  // Switching the defense team switches the opposing participant rail.
  await page.getByRole('button', { name: 'LAC defense' }).click();
  await expect(page.getByRole('heading', { name: 'LAC Defense Sheet' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Giannis Antetokounmpo player' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Damian Lillard player' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Kawhi Leonard player' })).toHaveCount(0);
  await expect(
    page
      .getByRole('article', { name: 'Giannis Antetokounmpo player' })
      .getByText('Focal game MIL vs. LAC · 35.1 MIN · 33.0 PTS'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'MIL defense' }).click();

  // Selecting a game-log participant opens the stored-data dossier.
  await page
    .getByRole('article', { name: 'Kawhi Leonard player' })
    .getByRole('button', { name: 'Open selection card' })
    .click();
  await expect(page).toHaveURL(new RegExp(`player=202695`));
  await expect(page.getByRole('heading', { name: 'Kawhi Leonard', level: 2 })).toBeVisible();
  await expect(
    page.getByText('Focal game LAC @ MIL · 2026-03-29 · 34.5 MIN · 24.0 PTS · 5.0 REB · 7.0 AST'),
  ).toBeVisible();
  await expect(
    page.getByText('Pregame samples use games strictly before the focal game.'),
  ).toBeVisible();
  await expect(
    page.getByText('Completed-season baseline — hindsight, not pregame evidence.'),
  ).toBeVisible();
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

  await page.setViewportSize({ width: 393, height: 852 });
  await expect(page.getByRole('heading', { name: 'MIL Defense Sheet' })).toBeVisible();
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

  const rail = page.getByRole('complementary', { name: 'Season scoring order' });
  const sheet = page.getByRole('region', { name: 'BOS Defense Sheet' });
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

  const playTypes = await page.getByRole('region', { name: 'Play types' }).boundingBox();
  const shotZones = await page.getByRole('region', { name: 'Shot zones' }).boundingBox();
  expect(Math.abs(playTypes.y - shotZones.y)).toBeLessThan(20);
  expect(playTypes.x).toBeLessThan(shotZones.x);
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
  await expect(page.getByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();
  await expect(page.getByText('Transition PTS')).toBeVisible();
  await expect(page.getByText('Above the Break 3 FGA')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shot zones' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Shot types' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assist locations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Traditional defense' })).toBeVisible();
  await expect(page.getByText('OPP REB')).toBeVisible();
  await expect(page.getByText('OPP TOV')).toBeVisible();
  await expect(page.getByText('OPP STL')).toBeVisible();
  await expect(page.getByText('OPP BLK')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Traditional defensive columns' })).toHaveCount(0);
  await expect(page.getByText('OPP PF')).toHaveCount(0);
  await expect(page.getByText('Assists', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Backcourt PTS')).toHaveCount(0);
  await expect(page.getByText('Isolation PTS')).toHaveCount(0);
  await expect(page.getByText('1 row hidden near league average.')).toBeVisible();
  await expect(page.getByText('+12.0% vs league')).toBeVisible();
  await expect(page.getByText('-11.0% vs league')).toBeVisible();
  await expect(page.getByText(/LeBron James · 19% poss/)).toBeVisible();
  await expect(page.getByText('Austin Reaves · 18% poss · +1.2σ')).toBeVisible();
  await expect(page.getByText('LeBron James · 27% FGA · +1.2σ')).toBeVisible();
  await expect(page.getByText('LeBron James · 36% FGA · +1.2σ')).toBeVisible();
  await expect(page.getByText('LeBron James · 31% ast · +1.4σ')).toBeVisible();
  // Would have passed the old fixed shot_zones gate (>= 25% FGA); hidden by
  // sigma_deviation (0.83) under the shared population's 1-sigma floor.
  await expect(page.getByText(/Austin Reaves · 25% FGA/)).toHaveCount(0);
  // Above the assist_locations sigma floor; hidden by the volume floor.
  await expect(page.getByText(/Austin Reaves · 35% ast/)).toHaveCount(0);
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
  await expect(page.getByText('Opponent rebounds unavailable for Last 15.')).toBeVisible();
  await expect(page.getByText('OPP TOV')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OPP_TOV' })).toHaveCount(0);
  await expect(page.getByText('No Defense Sheet rows match these controls.')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-legacy-traditional.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'REB', exact: true }).click();
  await expect(page.getByText('Opponent rebounds unavailable for Last 15.')).toBeVisible();
  await expect(page.getByText('No Defense Sheet rows match these controls.')).toHaveCount(0);
  await page.getByRole('button', { name: 'TOV', exact: true }).click();
  await expect(page.getByText('OPP TOV')).toBeVisible();
  await page.getByRole('button', { name: 'AST', exact: true }).click();
  await expect(
    page.getByText('Play types unavailable for Last 15: provider_unsupported.'),
  ).toHaveCount(0);
  await expect(page.getByText('AtRimAssists')).toBeVisible();
  await page.getByRole('button', { name: 'Season', exact: true }).click();

  await page.getByRole('button', { name: 'TOV', exact: true }).click();
  await expect(page.getByText('OPP TOV')).toBeVisible();
  await expect(page.getByText('OPP STL')).toHaveCount(0);

  await page.getByRole('button', { name: 'PTS' }).click();
  await expect(page.getByRole('article', { name: 'LeBron James player' })).toBeVisible();
  await expect(page.getByText(/Austin Reaves · 18% poss/)).toBeVisible();
  await page.getByRole('button', { name: 'Matchup Score' }).click();
  const sortedPlayers = page.getByRole('article', { name: /player$/ });
  await expect(sortedPlayers.first()).toHaveAccessibleName('Austin Reaves player');
  await expect(page.getByRole('heading', { name: 'PTS Matchup Score order' })).toBeVisible();
  await expect(page.getByText(/completed-season context/)).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-score-sort.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'FG2A' }).click();
  await expect(page.getByText('Restricted Area FGA')).toBeVisible();
  await expect(page.getByText('Above the Break 3 FGA')).toHaveCount(0);
  await expect(page.getByText('Catch and Shoot FG3A')).toHaveCount(0);
  await expect(page.getByText('Transition PTS')).toHaveCount(0);
  await expect(page.getByText(/Austin Reaves · 18% poss/)).toHaveCount(0);
  await page.getByRole('button', { name: 'FG3A' }).click();
  await expect(page.getByText('Restricted Area FGA')).toHaveCount(0);
  await expect(page.getByText('Above the Break 3 FGA')).toBeVisible();
  await expect(page.getByText('Catch and Shoot FG3A')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('matchup-detail-real-market-split.png'),
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
  await expect(page.getByText('Transition PTS')).toBeVisible();
  await expect(page.getByText('7.5', { exact: true })).toBeVisible();
  await expect(page.getByText('vs league: unavailable (not comparable)')).toHaveCount(1);
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
  await expect(page.getByText('Restricted Area FGA')).toBeVisible();
  await expect(page.getByText('Catch and Shoot FG3A')).toBeVisible();
  await expect(page.getByText(/LeBron James · 27% FGA/)).toBeVisible();
  await expect(page.getByText(/LeBron James · 36% FGA/)).toBeVisible();
  await expect(page.getByText('Postup PTS')).toBeVisible();
  await page.getByRole('button', { name: 'Last 15', exact: true }).click();
  await expect(page.getByText('Postup PTS')).toHaveCount(0);
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
  await expect(page.getByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();

  const rowAction = page.getByRole('button', { name: 'Save Restricted Area FGA as a Target' });
  await rowAction.click();

  // BOS owns the sheet, so BOS is the opponent and it is not up for editing.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('BOS', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Opponent')).toHaveCount(0);
  await expect(dialog.getByLabel('Qualifier 1 diet base')).toHaveValue('shot_zones');
  await expect(dialog.getByLabel('Qualifier 1 slice')).toHaveValue('Restricted Area');
  await expect(dialog.getByRole('button', { name: 'At or above' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // 20% is the league average this row is already being read against.
  await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('20');
  await expect(dialog.getByText('BOS vs Restricted area ≥ 20%')).toBeVisible();
  // The dialog is fixed to the viewport, so a full-page capture would show the
  // page it floats over; its fade is finished rather than waited out.
  await page.screenshot({
    path: testInfo.outputPath('matchup-capture.png'),
    animations: 'disabled',
  });

  // The prefill is a starting point: the threshold is the reader's to move.
  await dialog.getByLabel('Qualifier 1 threshold percent').fill('26');
  await dialog
    .getByLabel('Note · optional, never the title')
    .fill('Rim leaks against big lineups.');
  await dialog.getByRole('button', { name: 'Save Target' }).click();

  // The title in the confirmation is the one the backend derived and stored.
  await expect(dialog.getByText('BOS vs Restricted area ≥ 26%')).toBeVisible();
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
  await dialog.getByRole('button', { name: 'Back to the Defense Sheet' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(rowAction).toBeFocused();

  // The same row saved again is the duplicate the account already holds.
  await rowAction.click();
  await dialog.getByLabel('Qualifier 1 threshold percent').fill('26');
  await dialog.getByRole('button', { name: 'Save Target' }).click();
  await expect(dialog.getByRole('alert')).toContainText('You already have that Target for BOS.');
  await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('26');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A slice on a different base captures just as readily. Its league average is
  // 9.25%, so the prefill is the whole percent rather than the raw share, and
  // the backend spells this slice differently from the page: the confirmation
  // and the card both have to read the stored title, not the local preview.
  await page.getByRole('button', { name: 'Save Transition PTS as a Target' }).click();
  await expect(dialog.getByLabel('Qualifier 1 diet base')).toHaveValue('play_types');
  await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('9');
  await expect(dialog.getByText('BOS vs Transition ≥ 9%')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Target' }).click();
  await expect(dialog.getByText('BOS vs Transition offense ≥ 9%')).toBeVisible();
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
  await dialog.getByRole('link', { name: 'Go to Targets' }).click();

  await expect(page).toHaveURL('/targets');
  await expect(page.getByRole('heading', { name: '2 Targets', exact: true })).toBeVisible();
  const card = page.getByRole('link', { name: 'Open BOS vs Restricted area ≥ 26%' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Rim leaks against big lineups.');
  await expect(
    page.getByRole('link', { name: 'Open BOS vs Transition offense ≥ 9%' }),
  ).toBeVisible();
});

test('capture stays reachable and the sheet stays unscrolled at a phone width', async ({
  authenticatedPage: page,
}, testInfo) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await installApiContract(page);
  await page.goto('/matchups/0022500584');
  await expect(page.getByRole('heading', { name: 'BOS Defense Sheet' })).toBeVisible();

  await expect(page.getByRole('button', { name: /as a Target$/ })).not.toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole('button', { name: 'Save Restricted Area FGA as a Target' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Qualifier 1 threshold percent')).toHaveValue('20');
  await page.screenshot({
    path: testInfo.outputPath('matchup-capture-narrow.png'),
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
