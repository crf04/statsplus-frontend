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
  await panel.getByRole('button', { name: 'Add teams ranked 13–20 in Transition' }).click();
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
