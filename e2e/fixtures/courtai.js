import { expect, test as base } from '@playwright/test';

export const E2E_AUTH_STORAGE_KEY = 'courtai:e2e-authenticated';

const gameLogs = [
  {
    GAME_DATE: '2025-01-10',
    MATCHUP: 'LAL vs. ATL',
    'W/L': 'W',
    MIN: 36,
    PTS: 31,
    REB: 8,
    AST: 9,
    STL: 1,
    BLK: 1,
    TO: 3,
    FGM: 11,
    FGA: 20,
    FG_PCT: 0.55,
    FG3M: 4,
    FG3A: 8,
    FG3_PCT: 0.5,
    FTM: 5,
    FTA: 6,
  },
  {
    GAME_DATE: '2025-01-08',
    MATCHUP: 'LAL @ DAL',
    'W/L': 'L',
    MIN: 34,
    PTS: 27,
    REB: 7,
    AST: 8,
    STL: 2,
    BLK: 0,
    TO: 2,
    FGM: 10,
    FGA: 19,
    FG_PCT: 0.526,
    FG3M: 3,
    FG3A: 7,
    FG3_PCT: 0.429,
    FTM: 4,
    FTA: 4,
  },
];

const averages = {
  MIN: 35,
  PTS: 29,
  REB: 7.5,
  AST: 8.5,
  STKS: 2,
  FG_PCT: 0.538,
  FD_PTS: 51,
  TOV: 2.5,
};

export const installApiContract = async (page, overrides = {}) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const override = overrides[url.pathname];

    if (override) {
      const response = typeof override === 'function' ? await override(request) : override;
      await route.fulfill({ status: response.status || 200, json: response.body ?? response });
      return;
    }

    if (url.pathname === '/api/players') {
      await route.fulfill({ json: ['LeBron James', 'Stephen Curry', 'Kevin Durant'] });
      return;
    }

    if (url.pathname === '/api/teams') {
      await route.fulfill({ json: ['Atlanta Hawks', 'Dallas Mavericks'] });
      return;
    }

    if (url.pathname === '/api/nl-query') {
      await route.fulfill({
        json: {
          player_name: 'LeBron James',
          game_count: 10,
          confidence: 0.96,
        },
      });
      return;
    }

    if (url.pathname === '/api/games/game_logs') {
      await route.fulfill({
        json: {
          game_logs: gameLogs,
          averages: [averages],
          season_averages: [{ ...averages, PTS: 27, AST: 8 }],
          next_game: 'Atlanta Hawks',
        },
      });
      return;
    }

    if (url.pathname === '/api/players/profile') {
      await route.fulfill({ json: { Transition: 1.2, Isolation: 0.9 } });
      return;
    }

    if (url.pathname === '/api/teams/stats') {
      await route.fulfill({ json: { OPP_PTS: 112, OPP_PTS_RANK: 18 } });
      return;
    }

    await route.fulfill({ status: 501, json: { error: `Unhandled E2E route: ${url.pathname}` } });
  });
};

export const test = base.extend({
  browserHealth: [
    async ({ page }, run) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await run();
      expect(pageErrors, 'The browser page should not throw uncaught errors').toEqual([]);
    },
    { auto: true },
  ],
  authenticatedPage: async ({ page }, run) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, 'true');
    }, E2E_AUTH_STORAGE_KEY);
    await installApiContract(page);
    await run(page);
  },
});

export { expect };
