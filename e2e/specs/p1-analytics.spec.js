import {
  averages,
  E2E_AUTH_STORAGE_KEY,
  expect,
  gameLogs,
  installApiContract,
} from '../fixtures/courtai';
import { test } from '../fixtures/deployedSmoke';

const serializedGameLogs = [
  { ...gameLogs[0], GAME_DATE: '2026-04-12', WL: 'W', TOV: 3 },
  {
    ...gameLogs[0],
    GAME_DATE: '2026-04-12T00:00:00',
    WL: 'L',
    TOV: 2,
  },
  {
    ...gameLogs[0],
    GAME_DATE: 'Sun, 12 Apr 2026 00:00:00 GMT',
    WL: undefined,
    TOV: 1,
  },
];

const archetypeTemplate = {
  MIN: 30,
  FGM: 5,
  FGA: 10,
  FG3M: 2,
  FG3A: 4,
  FTM: 3,
  FTA: 4,
  PTS: 17,
  TOV: 1,
  'FGM/36MIN': 6,
  'FGA/36MIN': 12,
  'FG3M/36MIN': 2.4,
  'FG3A/36MIN': 4.8,
  'FTM/36MIN': 3.6,
  'FTA/36MIN': 4.8,
  'PTS/36MIN': 20.4,
  'FGM/36MIN_DIFF': 0,
  'FGA/36MIN_DIFF': 0,
  'FG3M/36MIN_DIFF': 0,
  'FG3A/36MIN_DIFF': 0,
  'FTM/36MIN_DIFF': 0,
  'FTA/36MIN_DIFF': 0,
  'PTS/36MIN_DIFF': 0,
};

const serializedArchetypeLogs = [
  ['LeBron James', '2026-04-12'],
  ['Anthony Davis', '2026-04-12T00:00:00'],
  ['Stephen Curry', 'Sun, 12 Apr 2026 00:00:00 GMT'],
].map(([playerName, gameDate]) => ({
  ...archetypeTemplate,
  PLAYER_NAME: playerName,
  GAME_DATE: gameDate,
}));

const p1AnalyticsOverrides = {
  '/api/games/game_logs': {
    body: {
      game_logs: serializedGameLogs,
      averages: [averages],
      season_averages: [{ ...averages }],
      next_game: 'Atlanta Hawks',
    },
  },
  '/api/players/profile': (request) => {
    const category = new URL(request.url()).searchParams.get('category');
    return category === 'Archetype'
      ? { body: serializedArchetypeLogs }
      : { body: { Transition: 1.2, Isolation: 0.9 } };
  },
};

const setupP1AnalyticsPage = async (page) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'true');
  }, E2E_AUTH_STORAGE_KEY);
  await installApiContract(page, p1AnalyticsOverrides);
};

test.describe('P1 game-log analytics', () => {
  test('@critical renders canonical game-log fields without shifting calendar dates', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/');
    await page.getByRole('textbox').fill('LeBron James last 10 games');
    await page.getByRole('textbox').press('Enter');

    await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
    const januaryTenth = page.getByRole('row').filter({ hasText: '1/10' });

    await expect(januaryTenth).toHaveCount(1);
    await expect(januaryTenth.getByRole('cell').nth(2)).toHaveText('W');
    await expect(januaryTenth.getByRole('cell').nth(17)).toHaveText('3');
    const per36Card = page
      .getByRole('heading', { name: 'Per 36 Minutes Comparison' })
      .locator('..');
    await expect(per36Card.getByText('53.8%', { exact: true })).toHaveCount(2);
  });

  for (const timezoneId of ['UTC', 'America/Chicago', 'Asia/Tokyo']) {
    test.describe(`serialized calendar dates in ${timezoneId}`, () => {
      test.use({ timezoneId });

      test('@critical keeps both game-log tables on the backend calendar day', async ({ page }) => {
        await setupP1AnalyticsPage(page);
        await page.goto('/?player_name=LeBron+James');

        await expect(page.getByRole('heading', { name: 'Game Logs', exact: true })).toBeVisible();
        const gameLogsCard = page
          .getByRole('heading', { name: 'Game Logs', exact: true })
          .locator('..');
        await expect(gameLogsCard.getByRole('cell', { name: '4/12', exact: true })).toHaveCount(3);
        await expect(gameLogsCard.getByRole('cell', { name: '-', exact: true })).toBeVisible();

        const playerProfileCard = page
          .getByRole('heading', { name: 'Player Profile', exact: true })
          .locator('..');
        await playerProfileCard.getByText('Archetype', { exact: true }).click();
        await expect(
          playerProfileCard.getByRole('cell', {
            name: '4/12/2026',
            exact: true,
          }),
        ).toHaveCount(3);
      });
    });
  }
});
