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

export const slateGame = {
  game_id: '0022500584',
  away_team: {
    team_id: 1610612747,
    tricode: 'LAL',
    name: 'Los Angeles Lakers',
    targetable_player_count: 5,
  },
  home_team: {
    team_id: 1610612738,
    tricode: 'BOS',
    name: 'Boston Celtics',
    targetable_player_count: 4,
  },
  scheduled_at: '2026-01-16T00:30:00Z',
  status: { state: 'scheduled', label: 'Scheduled' },
  classification: 'NBA Paris Game',
  preseason: false,
};

const scheduleOnlySlateGame = {
  ...slateGame,
  away_team: { ...slateGame.away_team, targetable_player_count: 0 },
  home_team: { ...slateGame.home_team, targetable_player_count: 0 },
};

export const slatePayload = (
  date,
  games,
  {
    poolStatus = 'unavailable',
    poolFreshnessStatus = 'unavailable',
    poolRetrievedAt = null,
    providers = {},
  } = {},
) => ({
  slate_date: date,
  freshness: {
    schedule: { status: 'fresh', retrieved_at: '2026-01-15T10:00:00Z' },
    pool: { status: poolFreshnessStatus, retrieved_at: poolRetrievedAt, providers },
  },
  pool_status: poolStatus,
  games,
});

const defenseValue = (allowed, relative, sigma, rank) => ({
  allowed_per_48: allowed,
  percent_vs_league_average: relative,
  sigma_deviation: sigma,
  rank,
});

const defenseRow = (key, label, markets, season, last15) => ({
  key,
  label,
  markets,
  season,
  last_15: last15,
});

const teamSheet = (team, rows) => ({
  team_id: team.team_id,
  tricode: team.tricode,
  name: team.name,
  defense_sheet: { play_types: rows },
});

const dietShare = (key, seasonShare, last15Share) => ({
  key,
  season: { share: seasonShare, volume_per_game: 5.1 },
  last_15: { share: last15Share, volume_per_game: 5.4 },
});

export const matchupPayload = {
  game: slateGame,
  teams: [
    teamSheet(slateGame.away_team, [
      defenseRow(
        'transition',
        'Transition',
        ['PTS', 'FGA'],
        defenseValue(17.1, 9, 1.2, 24),
        defenseValue(14.8, -9, -1.1, 6),
      ),
      defenseRow(
        'isolation',
        'Isolation',
        ['PTS'],
        defenseValue(8.2, 2, 0.3, 16),
        defenseValue(9, 5, 0.6, 19),
      ),
    ]),
    teamSheet(slateGame.home_team, [
      defenseRow(
        'transition',
        'Transition',
        ['PTS', 'FGA'],
        defenseValue(18.4, 12, 1.4, 27),
        defenseValue(15.2, -8, -1.1, 5),
      ),
      defenseRow(
        'above-break',
        'Above-break three',
        ['FG3A'],
        defenseValue(10.2, -11, -1.3, 3),
        defenseValue(11, -6, -0.7, 9),
      ),
      defenseRow(
        'isolation',
        'Isolation',
        ['PTS'],
        defenseValue(8.1, 2, 0.4, 16),
        defenseValue(8.4, 4, 0.5, 18),
      ),
    ]),
  ],
  players: [
    {
      canonical_id: 'lebron-james',
      name: 'LeBron James',
      team_id: slateGame.away_team.team_id,
      tricode: 'LAL',
      posted_markets: ['PTS', 'FGA'],
      season_scoring: 25.4,
      last_10_minutes: [35, 36, 38, 34, 37, 36, 35, 39, 36, 37],
      diet_shares: { play_types: [dietShare('transition', 0.19, 0.2)] },
      injury_badge_ref: null,
    },
    {
      canonical_id: 'austin-reaves',
      name: 'Austin Reaves',
      team_id: slateGame.away_team.team_id,
      tricode: 'LAL',
      posted_markets: ['PTS', 'FG3A'],
      season_scoring: 20.1,
      last_10_minutes: [32, 35, 34, 33, 31, 35, 36, 34, 35, 33],
      diet_shares: { play_types: [dietShare('transition', 0.14, 0.18)] },
      injury_badge_ref: 'injury-austin',
    },
    {
      canonical_id: 'jayson-tatum',
      name: 'Jayson Tatum',
      team_id: slateGame.home_team.team_id,
      tricode: 'BOS',
      posted_markets: ['PTS', 'FGA', 'FG3A'],
      season_scoring: 27.2,
      last_10_minutes: [36, 37, 35, 38, 34, 36, 39, 37, 36, 38],
      diet_shares: { play_types: [dietShare('transition', 0.21, 0.23)] },
      injury_badge_ref: null,
    },
  ],
  injuries: {
    status: 'fresh',
    unavailable_reason: null,
    retrieved_at: '2026-01-15T11:55:00Z',
    source: 'rotowire',
    source_url: 'https://www.rotowire.com/basketball/injury-report.php',
    teams: [
      {
        team_id: slateGame.away_team.team_id,
        tricode: 'LAL',
        submission_state: 'unknown',
        entries: [
          {
            entry_id: 'injury-austin',
            canonical_player_id: 'austin-reaves',
            source_player_name: 'Austin Reaves',
            team_id: slateGame.away_team.team_id,
            tricode: 'LAL',
            status: null,
            raw_status: 'Game-time decision',
            reason: 'Left calf soreness',
            source_url: 'https://www.rotowire.com/basketball/player/austin-reaves-5440',
          },
          {
            entry_id: 'injury-non-pool',
            canonical_player_id: null,
            source_player_name: 'Maxi Kleber',
            team_id: slateGame.away_team.team_id,
            tricode: 'LAL',
            status: 'Out',
            raw_status: 'Out',
            reason: 'Right foot recovery',
            source_url: 'https://www.rotowire.com/basketball/player/maxi-kleber-3929',
          },
          ...['Probable', 'Questionable', 'Doubtful'].map((status, index) => ({
            entry_id: `injury-${status.toLowerCase()}`,
            canonical_player_id: null,
            source_player_name: ['Gabe Vincent', 'Jarred Vanderbilt', 'Jordan Goodwin'][index],
            team_id: slateGame.away_team.team_id,
            tricode: 'LAL',
            status,
            raw_status: status,
            reason: ['Left knee soreness', 'Right shoulder soreness', 'Illness'][index],
            source_url: 'https://www.rotowire.com/basketball/injury-report.php',
          })),
        ],
      },
      {
        team_id: slateGame.home_team.team_id,
        tricode: 'BOS',
        submission_state: 'unknown',
        entries: [],
      },
    ],
  },
  freshness: {
    schedule: { status: 'fresh', retrieved_at: '2026-01-15T10:00:00Z' },
    pool: {
      status: 'fresh',
      retrieved_at: '2026-01-15T11:50:00Z',
      providers: {
        prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T11:50:00Z' },
      },
    },
    stats: { status: 'fresh', retrieved_at: '2026-01-15T10:00:00Z' },
    injuries: { status: 'fresh', retrieved_at: '2026-01-15T11:55:00Z' },
  },
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

    if (url.pathname === '/api/games/slate') {
      const date = url.searchParams.get('date') || '2026-01-15';
      await route.fulfill({ json: slatePayload(date, [scheduleOnlySlateGame]) });
      return;
    }

    if (url.pathname === '/api/games/matchup') {
      await route.fulfill({ json: matchupPayload });
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
