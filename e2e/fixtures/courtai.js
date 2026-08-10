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
  { poolFreshnessStatus = 'unavailable', poolRetrievedAt = null, providers = {} } = {},
) => ({
  slate_date: date,
  freshness: {
    schedule: { status: 'fresh', retrieved_at: '2026-01-15T10:00:00Z' },
    pool: { status: poolFreshnessStatus, retrieved_at: poolRetrievedAt, providers },
  },
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

const defensiveColumns = (offset = 0) => ({
  OPP_TOV: {
    season: { per_48: 14.2 + offset, percent_vs_league_average: 8 },
    last_15: { per_48: 12.9 + offset, percent_vs_league_average: -3 },
  },
  OPP_STL: {
    season: { per_48: 7.1 + offset, percent_vs_league_average: -5 },
    last_15: { per_48: 7.8 + offset, percent_vs_league_average: 4 },
  },
  OPP_BLK: {
    season: { per_48: 5.4 + offset, percent_vs_league_average: 11 },
    last_15: { per_48: 4.7 + offset, percent_vs_league_average: -2 },
  },
});

const teamSheet = (team, playTypes, offset = 0) => ({
  team_id: team.team_id,
  tricode: team.tricode,
  name: team.name,
  defense_sheet: {
    play_types: playTypes,
    shot_zones: [
      defenseRow(
        'paint',
        'Paint',
        ['PTS', 'FGA'],
        defenseValue(22 + offset, 10, 1.2, 25),
        defenseValue(20 + offset, -7, -1.1, 7),
      ),
    ],
    shot_types: [
      defenseRow(
        'catch-shoot',
        'Catch and shoot',
        ['PTS', 'FG3A'],
        defenseValue(16 + offset, 9, 1.1, 23),
        defenseValue(15 + offset, 8, 1.2, 22),
      ),
    ],
    assist_locations: [
      defenseRow(
        'paint-assists',
        'Paint assists',
        ['AST'],
        defenseValue(11 + offset, 13, 1.5, 28),
        defenseValue(10 + offset, 9, 1.1, 24),
      ),
    ],
    traditional: [
      defenseRow(
        'opponent-rebounds',
        'Opponent rebounds',
        ['REB'],
        defenseValue(45 + offset, -8, -1.2, 4),
        defenseValue(47 + offset, 6, 1.1, 21),
      ),
    ],
  },
  defensive_columns: defensiveColumns(offset),
});

const dietShare = (key, seasonShare, last15Share, seasonVolume = 5.1, last15Volume = 5.4) => ({
  key,
  season: { share: seasonShare, volume_per_game: seasonVolume },
  last_15: { share: last15Share, volume_per_game: last15Volume },
});

const scoreWindow = (value, market) => ({
  components: ['TOV', 'STL', 'BLK', 'STKS'].includes(market)
    ? { traditional: { value, thin: false } }
    : {
        play_types: { value: value - 0.01, thin: market === 'AST' },
        shot_zones: { value, thin: false },
      },
  ...(!['TOV', 'STL', 'BLK', 'STKS'].includes(market) && {
    blend: { value, thin: false },
  }),
});

const scores = (markets, seasonValue, last15Value) =>
  Object.fromEntries(
    markets.map((market, index) => [
      market,
      {
        season: scoreWindow(seasonValue + index / 100, market),
        last_15: scoreWindow(last15Value + index / 100, market),
      },
    ]),
  );

export const matchupPayload = {
  game: {
    ...slateGame,
    away_team: { ...slateGame.away_team, targetable_player_count: 2 },
    home_team: { ...slateGame.home_team, targetable_player_count: 1 },
  },
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
    teamSheet(
      slateGame.home_team,
      [
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
        defenseRow(
          'post-up',
          'Post up',
          ['PTS'],
          defenseValue(12.1, 10, 1.2, 25),
          defenseValue(12.8, 11, 1.3, 26),
        ),
      ],
      1,
    ),
  ],
  // The backend owns the Out override. Maxi Kleber represents a board-posted
  // player removed from the returned Player Pool while remaining in injuries;
  // the frontend renders this authoritative result and does not reimplement it.
  players: [
    {
      canonical_id: 'lebron-james',
      name: 'LeBron James',
      team_id: slateGame.away_team.team_id,
      tricode: 'LAL',
      posted_markets: ['PTS', 'FGA', 'AST', 'REB', 'PRA', 'TOV'],
      season_scoring: 25.4,
      last_10_minutes: [35, 36, 38, 34, 37, 36, 35, 39, 36, 37],
      diet_shares: {
        play_types: [dietShare('transition', 0.19, 0.2), dietShare('post-up', 0.02, 0.16)],
        shot_zones: [dietShare('paint', 0.27, 0.28)],
        shot_types: [dietShare('catch-shoot', 0.36, 0.37, 4.2, 4.3)],
        assist_locations: [dietShare('paint-assists', 0.31, 0.32, 1.1, 1.2)],
      },
      injury_badge_ref: null,
      scores: scores(['PTS', 'FGA', 'AST', 'REB', 'PRA', 'TOV'], 0.12, -0.02),
    },
    {
      canonical_id: 'austin-reaves',
      name: 'Austin Reaves',
      team_id: slateGame.away_team.team_id,
      tricode: 'LAL',
      posted_markets: ['PTS', 'FG3A', 'STL'],
      season_scoring: 20.1,
      last_10_minutes: [32, 35, 34, 33, 31, 35, 36, 34, 35, 33],
      diet_shares: {
        // Above the display gate but intentionally posted for PTS, not FGA,
        // so market-tab chip scoping remains observable at the browser seam.
        play_types: [dietShare('transition', 0.18, 0.18)],
        shot_zones: [dietShare('paint', 0.24, 0.26)],
        shot_types: [dietShare('catch-shoot', 0.4, 0.41, 3.9, 3.8)],
        assist_locations: [dietShare('paint-assists', 0.35, 0.36, 0.8, 0.9)],
      },
      injury_badge_ref: 'injury-austin',
      scores: scores(['PTS', 'FG3A', 'STL'], 0.24, 0.08),
    },
    {
      canonical_id: 'jayson-tatum',
      name: 'Jayson Tatum',
      team_id: slateGame.home_team.team_id,
      tricode: 'BOS',
      posted_markets: ['PTS', 'FGA', 'FG3A', 'REB', 'BLK'],
      season_scoring: 27.2,
      last_10_minutes: [36, 37, 35, 38, 34, 36, 39, 37, 36, 38],
      diet_shares: {
        play_types: [dietShare('transition', 0.21, 0.23)],
        shot_zones: [dietShare('paint', 0.29, 0.3)],
        shot_types: [dietShare('catch-shoot', 0.39, 0.4, 4.8, 5)],
        assist_locations: [dietShare('paint-assists', 0.33, 0.34, 1.2, 1.3)],
      },
      injury_badge_ref: null,
      scores: scores(['PTS', 'FGA', 'FG3A', 'REB', 'BLK'], 0.15, 0.11),
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
            canonical_player_id: 'maxi-kleber',
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

const selectionLine = (date, matchup, minutes, values, deltas) => ({
  row_type: date === null ? 'average' : 'game',
  game_date: date,
  matchup: date === null ? null : matchup,
  minutes,
  stats: values,
  deltas,
});

export const selectionPayload = {
  player_id: 'lebron-james',
  h2h: {
    thin: false,
    rows: [
      selectionLine(
        '2025-12-25',
        'LAL vs. BOS',
        36,
        { PTS: 31, FGA: 19, AST: 9, REB: 8, PRA: 48, TOV: 3 },
        { PTS: 0.083, FGA: 0.018, AST: 0.031, REB: -0.012, PRA: 0.102, TOV: 0.006 },
      ),
      selectionLine(
        null,
        'AVG',
        36,
        { PTS: 31, FGA: 19, AST: 9, REB: 8, PRA: 48, TOV: 3 },
        { PTS: 0.083, FGA: 0.018, AST: 0.031, REB: -0.012, PRA: 0.102, TOV: 0.006 },
      ),
    ],
  },
  archetype: {
    thin: true,
    rows: [
      selectionLine(
        '2025-12-20',
        'DAL @ BOS',
        34,
        { PTS: 28, FGA: 18, AST: 7, REB: 8, PRA: 43, TOV: 3 },
        { PTS: 0.041, FGA: 0.015, AST: -0.009, REB: -0.012, PRA: 0.02, TOV: 0.006 },
      ),
      selectionLine(
        null,
        'AVG',
        34,
        { PTS: 28, FGA: 18, AST: 7, REB: 8, PRA: 43, TOV: 3 },
        { PTS: 0.041, FGA: 0.015, AST: -0.009, REB: -0.012, PRA: 0.02, TOV: 0.006 },
      ),
    ],
  },
};

export const austinSelectionPayload = {
  player_id: 'austin-reaves',
  h2h: { thin: false, rows: [] },
  archetype: {
    thin: true,
    rows: [
      selectionLine(
        '2025-12-18',
        'MIA @ BOS',
        33,
        { PTS: 22, FG3A: 7, STL: 1 },
        { PTS: 0.022, FG3A: 0.013, STL: -0.004 },
      ),
      selectionLine(
        null,
        'AVG',
        33,
        { PTS: 22, FG3A: 7, STL: 1 },
        { PTS: 0.022, FG3A: 0.013, STL: -0.004 },
      ),
    ],
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

    if (url.pathname === '/api/games/matchup/selection') {
      const gameId = url.searchParams.get('game_id');
      const playerId = url.searchParams.get('player_id');
      const payloads = {
        'lebron-james': selectionPayload,
        'austin-reaves': austinSelectionPayload,
      };
      if (gameId !== matchupPayload.game.game_id || !payloads[playerId]) {
        await route.fulfill({ status: 404, json: { error: { code: 'resource_not_found' } } });
        return;
      }
      await route.fulfill({ json: payloads[playerId] });
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
