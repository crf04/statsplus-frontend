import { test, expect, gameLogs, curryGameLogs, averages } from '../fixtures/courtai';

// A slow render widens the interval between choosing a player and committing
// the router transition. HTTP delays cannot reproduce this scheduling race.
test('a stat chosen immediately after switching players stays selected', async ({
  authenticatedPage: page,
}) => {
  await page.route('**/api/games/game_logs**', async (route) => {
    const player = new URL(route.request().url()).searchParams.get('player_name');
    await route.fulfill({
      json: {
        game_logs: player === 'Stephen Curry' ? curryGameLogs : gameLogs,
        averages: [averages],
        season_averages: [averages],
        next_game: 'Atlanta Hawks',
      },
    });
  });
  await page.goto('/?player_name=LeBron+James&game_filter=10');
  await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
  await page.getByTestId('filter-panel').getByRole('button', { name: '+ Own stat line' }).click();
  await page.getByLabel('Player:').fill('Stephen');
  const player = page.getByRole('option', { name: 'Stephen Curry' });
  await expect(player).toBeVisible();
  const stat = page.getByRole('combobox', { name: 'Stat', exact: true });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await player.click();
    await stat.selectOption('PTS');
  } finally {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  }
  await expect(page.getByRole('cell', { name: '42', exact: true })).toBeVisible();
  await expect(stat).toHaveValue('PTS');
  await expect(page.getByText('18–42', { exact: true })).toBeVisible();
});
