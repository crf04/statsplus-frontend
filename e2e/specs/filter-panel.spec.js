import { expect, test } from '@playwright/test';
import { E2E_AUTH_STORAGE_KEY } from '../fixtures/courtai';
import { installParityApi, PARITY_PATH } from '../filterPanelParity/fixture';

const open = async (page, opponent) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await installParityApi(page);
  await page.route('**/api/players/next-opponent?**', (route) => route.fulfill({ json: opponent }));
  await page.goto(PARITY_PATH);
  return page.getByTestId('filter-panel');
};

test('next opponent tiers follow their own ranked population and omit middle/context add controls', async ({
  page,
}) => {
  const panel = await open(page, {
    next_game: {
      game_id: '0022600001',
      date: '2026-10-22',
      opponent: 'CHA',
      opponent_name: 'Charlotte Hornets',
      home: false,
    },
    opponent_ranks: [
      {
        group: 'Play types',
        label: 'Transition (per poss.)',
        value: 1.17,
        vs_league_pct: 17,
        most_rank: 19,
        ranked_teams: 20,
        team_filter: 'Transition',
        unit: 'league_ratio',
      },
      {
        group: 'General',
        label: 'Points',
        value: 110,
        vs_league_pct: null,
        most_rank: 15,
        ranked_teams: 30,
        team_filter: 'OPP_PTS',
        unit: 'count',
      },
      {
        group: 'Assists',
        label: 'Context only',
        value: 1.3,
        vs_league_pct: 30,
        most_rank: 1,
        ranked_teams: 12,
        team_filter: null,
        unit: 'league_ratio',
      },
    ],
  });
  await expect(panel.getByText('2nd fewest')).toBeVisible();
  await expect(panel.getByText('+17% vs avg')).toBeVisible();
  await expect(panel.getByText('Points', { exact: true })).toHaveCount(0);
  await expect(panel.getByText('1st most')).toBeVisible();
  await expect(panel.getByRole('button', { name: /Add teams ranked.*Context only/ })).toHaveCount(
    0,
  );
  const addTier = panel.getByRole('button', { name: 'Add teams ranked 13–20 in Transition' });
  await addTier.click();
  await expect(addTier).toBeDisabled();
  await expect(addTier).toHaveText('✓');
  await panel.getByRole('button', { name: 'Apply 1 change' }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll('rank_filter[]'))
    .toEqual(['13,20']);
});

test('no scheduled game hides opponent context and saved sets still navigate', async ({ page }) => {
  const panel = await open(page, { next_game: null, opponent_ranks: [] });
  await expect(panel.getByText(/of 72 games match/)).toBeVisible();
  await expect(panel.getByText(/^Next:/)).toHaveCount(0);
  await panel.getByRole('button', { name: /JJ last 10 at home/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('location_filter')).toBe('Home');
});

test('a historical Filter Set shares its season with the strip read', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await installParityApi(page);
  const requests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/games/game_logs') requests.push(url);
  });
  await page.goto(`${PARITY_PATH}&season_filter=2023-24`);
  await expect(page.getByTestId('filter-panel').getByText(/of 72 games match/)).toBeVisible();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests.map((url) => url.searchParams.get('season_filter'))).toEqual([
    '2023-24',
    '2023-24',
  ]);
});

test('a bottom tier with fewer than eight ranked teams remains a valid inclusive filter', async ({
  page,
}) => {
  const panel = await open(page, {
    next_game: {
      game_id: '0022600001',
      date: '2026-10-22',
      opponent: 'CHA',
      opponent_name: 'Charlotte Hornets',
      home: false,
    },
    opponent_ranks: [
      {
        group: 'Play types',
        label: 'Isolation (per poss.)',
        value: 0.8,
        vs_league_pct: -20,
        most_rank: 4,
        ranked_teams: 5,
        team_filter: 'Isolation',
        unit: 'league_ratio',
      },
    ],
  });
  await expect(panel.getByText('2nd fewest')).toBeVisible();
  await panel.getByRole('button', { name: 'Add teams ranked 1–5 in Isolation' }).click();
  await panel.getByRole('button', { name: 'Apply 1 change' }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.getAll('teams_against[]'))
    .toEqual(['Isolation']);
  expect(new URL(page.url()).searchParams.getAll('rank_filter[]')).toEqual(['5']);
});

test('the most-allowed tier applies ranks one through eight and stays marked added', async ({
  page,
}) => {
  const panel = await open(page, {
    next_game: {
      game_id: '0022600001',
      date: '2026-10-22',
      opponent: 'CHA',
      opponent_name: 'Charlotte Hornets',
      home: false,
    },
    opponent_ranks: [
      {
        group: 'General',
        label: 'Points',
        value: 120,
        vs_league_pct: null,
        most_rank: 2,
        ranked_teams: 30,
        team_filter: 'OPP_PTS',
        unit: 'count',
      },
    ],
  });
  const add = panel.getByRole('button', { name: 'Add teams ranked 1–8 in Points Allowed' });
  await add.click();
  await expect(add).toBeDisabled();
  await expect(add).toHaveText('✓');
  await panel.getByRole('button', { name: 'Apply 1 change' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll('rank_filter[]')).toEqual(['8']);
});

test('signed-out shared readers send no account or next-opponent requests', async ({ page }) => {
  await installParityApi(page);
  const accountReads = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/user/saved-filter-sets' || path === '/api/players/next-opponent')
      accountReads.push(path);
  });
  await page.goto(PARITY_PATH);
  await expect(page.getByTestId('filter-panel')).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Sign in to load these game logs' }),
  ).toBeVisible();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  expect(accountReads).toEqual([]);
});

test('opening a Saved Filter Set marks its visible name as open', async ({ page }) => {
  const panel = await open(page, { next_game: null, opponent_ranks: [] });
  const saved = panel.getByRole('button', { name: /JJ last 10 at home/ });
  await saved.click();
  await expect
    .poll(() =>
      saved.evaluate((element) => getComputedStyle(element.querySelector('b'), '::after').content),
    )
    .toBe('" · open"');
});

test('switching seasons for one player reloads bounds and withholds the previous season', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await installParityApi(page);
  await page.route('**/api/user/saved-filter-sets', (route) =>
    route.fulfill({
      json: {
        saved_filter_sets: [
          {
            id: 'season-b',
            name: 'Season B',
            query_string: 'player_name=Jalen+Johnson&game_filter=10&season_filter=2024-25',
          },
        ],
      },
    }),
  );
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const seasonRequests = [];
  await page.route('**/api/games/game_logs**', async (route) => {
    const url = new URL(route.request().url());
    const season = url.searchParams.get('season_filter');
    if (!url.searchParams.has('game_filter')) {
      seasonRequests.push(season);
      if (season === '2024-25') await held;
    }
    const second = season === '2024-25';
    await route.fulfill({
      json: {
        game_logs: [
          {
            GAME_DATE: second ? '2025-01-01' : '2024-01-01',
            MATCHUP: 'ATL @ CHA',
            PTS: second ? 35 : 15,
          },
        ],
        averages: [{ PTS: 20 }],
        season_averages: [{ PTS: 20 }],
        next_game: null,
      },
    });
  });
  await page.goto('/?player_name=Jalen+Johnson&game_filter=10&season_filter=2023-24');
  const panel = page.getByTestId('filter-panel');
  await expect(panel.getByText(/of 1 games match/)).toBeVisible();
  await panel.getByRole('button', { name: /Season B/ }).click();
  await expect.poll(() => seasonRequests).toEqual(['2023-24', '2024-25']);
  await panel.getByRole('button', { name: '+ Own stat line' }).click();
  await panel.getByRole('combobox', { name: 'Stat', exact: true }).selectOption('PTS');
  await expect(panel.getByRole('slider', { name: 'Minimum PTS' })).toHaveCount(0);
  await expect(panel.getByText('Loading the season range…').first()).toBeVisible();
  release();
  await expect(panel.getByRole('slider', { name: 'Minimum PTS' })).toHaveAttribute(
    'aria-valuenow',
    '35',
  );
  await expect(panel.getByRole('button', { name: /2025-01-01 ATL @ CHA/ })).toBeVisible();
});

test('the panel lists only Saved Filter Sets for the player on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await installParityApi(page);
  await page.route('**/api/players/next-opponent?**', (route) =>
    route.fulfill({ json: { next_game: null, opponent_ranks: [] } }),
  );
  await page.route('**/api/user/saved-filter-sets', (route) =>
    route.fulfill({
      json: {
        saved_filter_sets: [
          {
            id: 'jj',
            name: 'JJ at home',
            query_string: 'player_name=jalen++johnson&location_filter=Home',
          },
          {
            id: 'trae',
            name: 'Trae at home',
            query_string: 'player_name=Trae+Young&location_filter=Home',
          },
          { id: 'none', name: 'No player', query_string: 'game_filter=10' },
        ],
      },
    }),
  );
  await page.goto(PARITY_PATH);
  const panel = page.getByTestId('filter-panel');
  await expect(panel.getByRole('button', { name: /JJ at home/ })).toBeVisible();
  await expect(panel.getByRole('button', { name: /Trae at home/ })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /No player/ })).toHaveCount(0);
  await expect(panel.getByText(/^Saved Filter Sets\s*1$/)).toBeVisible();
});

test('a player with no Saved Filter Sets is told so by name', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript((key) => localStorage.setItem(key, 'true'), E2E_AUTH_STORAGE_KEY);
  await installParityApi(page);
  await page.route('**/api/players/next-opponent?**', (route) =>
    route.fulfill({ json: { next_game: null, opponent_ranks: [] } }),
  );
  await page.route('**/api/user/saved-filter-sets', (route) =>
    route.fulfill({
      json: {
        saved_filter_sets: [
          {
            id: 'trae',
            name: 'Trae at home',
            query_string: 'player_name=Trae+Young&location_filter=Home',
          },
        ],
      },
    }),
  );
  await page.goto(PARITY_PATH);
  const panel = page.getByTestId('filter-panel');
  await expect(panel.getByText('No saved sets for Jalen Johnson yet.')).toBeVisible();
  await expect(panel.getByRole('button', { name: /Trae at home/ })).toHaveCount(0);
});
