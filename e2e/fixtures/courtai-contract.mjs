import statCatalogue from '../../src/targets/targetStatCatalogue.json' with { type: 'json' };
import reportFixture from './report.json' with { type: 'json' };

export const E2E_AUTH_STORAGE_KEY = 'courtai:e2e-authenticated';
export const E2E_ADMIN_STORAGE_KEY = 'courtai:e2e-admin';

export const gameLogs = [
  {
    GAME_DATE: '2025-01-10',
    MATCHUP: 'LAL vs. ATL',
    WL: 'W',
    MIN: 36,
    PTS: 31,
    REB: 8,
    OREB: 2,
    DREB: 6,
    REB_CHANCES: 14,
    OREB_CHANCES: 5,
    DREB_CHANCES: 9,
    POTENTIAL_AST: 17,
    PF: 2,
    AST: 9,
    STL: 1,
    BLK: 1,
    TOV: 3,
    FGM: 11,
    FGA: 20,
    FG_PCT: 0.55,
    USG_PCT: 31.2,
    FG3M: 4,
    FG3A: 8,
    FG3_PCT: 0.5,
    FTM: 5,
    FTA: 6,
  },
  {
    GAME_DATE: '2025-01-08',
    MATCHUP: 'LAL @ DAL',
    WL: 'L',
    MIN: 34,
    PTS: 27,
    REB: 7,
    OREB: 1,
    DREB: 6,
    REB_CHANCES: null,
    OREB_CHANCES: null,
    DREB_CHANCES: null,
    POTENTIAL_AST: null,
    PF: 3,
    AST: 8,
    STL: 2,
    BLK: 0,
    TOV: 2,
    FGM: 10,
    FGA: 19,
    FG_PCT: 0.526,
    USG_PCT: 28.6,
    FG3M: 3,
    FG3A: 7,
    FG3_PCT: 0.429,
    FTM: 4,
    FTA: 4,
  },
];

export const averages = {
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

export const slateGameWithMissingNameSentinels = {
  ...slateGame,
  away_team: { ...slateGame.away_team, name: 'None' },
  home_team: { ...slateGame.home_team, name: 'None' },
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
    poolFreshnessStatus = 'unavailable',
    poolRetrievedAt = /** @type {string | null} */ (null),
    providers = {},
    previousGameDate = /** @type {string | null} */ (null),
    nextGameDate = /** @type {string | null} */ (null),
    fallback = /** @type {string | null} */ (null),
    trailing = /** @type {{ family: string, serving_season: string, rule: string }[] | undefined} */ (
      undefined
    ),
  } = {},
) => ({
  ...(trailing === undefined ? {} : { trailing }),
  slate_date: date,
  previous_game_date: previousGameDate,
  next_game_date: nextGameDate,
  fallback,
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

/*
 * Rebound Types is a breakdown of OPP_REB, so a team's six slices add up to its
 * Season OPP_REB (45, plus the team offset, carried by the second slice) and the
 * league averages add up to the league OPP_REB average (46). Last 15 slices add
 * up to the same total, since the fixture withholds Last 15 OPP_REB itself.
 * Relative percent and sigma are derived from the league figures.
 */
const REBOUND_TYPES = [
  { key: 'DefTwoPtRebounds', average: 21, sigma: 1.5, season: 19, last15: 18.6, ranks: [6, 5] },
  { key: 'DefThreePtRebounds', average: 12, sigma: 0.5, season: 12.6, last15: 13, ranks: [24, 26] },
  { key: 'FTDefRebounds', average: 1.3, sigma: 0.08, season: 1.4, last15: 1.3, ranks: [26, 15] },
  { key: 'OffTwoPtRebounds', average: 7.2, sigma: 0.6, season: 8.2, last15: 8.4, ranks: [27, 28] },
  { key: 'OffThreePtRebounds', average: 3.5, sigma: 0.5, season: 2.9, last15: 3, ranks: [5, 7] },
  { key: 'FTOffRebounds', average: 1, sigma: 0.08, season: 0.9, last15: 0.7, ranks: [8, 3] },
];
const reboundValue = (allowed, average, sigma, rank) =>
  defenseValue(
    allowed,
    Math.round(((allowed - average) / average) * 100),
    Math.round(((allowed - average) / sigma) * 10) / 10,
    rank,
  );

const teamSheet = (team, playTypes, offset = 0) => ({
  team_id: team.team_id,
  tricode: team.tricode,
  name: team.name,
  defense_sheet: {
    play_types: playTypes.map((row) => ({ ...row, last_15: null })),
    shot_zones: [
      defenseRow(
        'Restricted Area:FGA',
        'Restricted Area FGA',
        ['FGA', 'FG2A'],
        defenseValue(22 + offset, 10, 1.2, 25),
        defenseValue(20 + offset, -7, -1.1, 7),
      ),
      defenseRow(
        'Above the Break 3:FGA',
        'Above the Break 3 FGA',
        ['FGA', 'FG3A'],
        defenseValue(10.2 + offset, -11, -1.3, 3),
        defenseValue(11 + offset, -6, -0.7, 9),
      ),
    ],
    // Last 15 is still on the previous season, so shot types carry no L15 value.
    shot_types: [
      defenseRow(
        'Catch and Shoot:FG3A',
        'Catch and Shoot FG3A',
        ['FGA', 'FG3A'],
        defenseValue(16 + offset, 9, 1.1, 23),
        defenseValue(15 + offset, 8, 1.2, 22),
      ),
    ].map((row) => ({ ...row, last_15: null })),
    assist_locations: [
      defenseRow(
        'AtRimAssists',
        'AtRimAssists',
        ['AST', 'PA', 'RA', 'PRA'],
        defenseValue(11 + offset, 13, 1.5, 28),
        defenseValue(10 + offset, 9, 1.1, 24),
      ),
      defenseRow(
        'Assists',
        'Assists',
        ['AST', 'PA', 'RA', 'PRA'],
        defenseValue(25 + offset, 4, 0.6, 18),
        defenseValue(24 + offset, 2, 0.4, 16),
      ),
    ],
    traditional: [
      defenseRow(
        'OPP_REB',
        'OPP REB',
        ['REB', 'PR', 'RA', 'PRA'],
        defenseValue(45 + offset, -8, -1.2, 4),
        null,
      ),
      defenseRow(
        'OPP_TOV',
        'OPP TOV',
        ['TOV'],
        defenseValue(14.8 + offset, 10, 1.3, 25),
        defenseValue(13.4 + offset, 5, 1.1, 22),
      ),
      defenseRow(
        'OPP_STL',
        'OPP STL',
        ['STL', 'STKS'],
        defenseValue(6.9 + offset, -8, -1.1, 6),
        defenseValue(7.3 + offset, 3, 1.2, 19),
      ),
      defenseRow(
        'OPP_BLK',
        'OPP BLK',
        ['BLK', 'STKS'],
        defenseValue(5.1 + offset, 9, 1.4, 24),
        defenseValue(4.6 + offset, -4, -1.1, 8),
      ),
      defenseRow(
        'OPP_PF',
        'OPP PF',
        [],
        defenseValue(20 + offset, 3, 0.4, 17),
        defenseValue(19 + offset, -2, -0.3, 13),
      ),
    ],
    rebound_types: REBOUND_TYPES.map(({ key, average, sigma, season, last15, ranks }, index) =>
      defenseRow(
        key,
        key,
        ['REB', 'PR', 'RA', 'PRA'],
        reboundValue(season + (index === 1 ? offset : 0), average, sigma, ranks[0]),
        reboundValue(last15 + (index === 1 ? offset : 0), average, sigma, ranks[1]),
      ),
    ),
  },
  defensive_columns: defensiveColumns(offset),
});

// Deterministic stand-ins for aggregates derived across all 30 NBA teams.
const leagueRow = (key, seasonAverage, seasonSigma, last15Average, last15Sigma) => ({
  key,
  season: { average_allowed_per_48: seasonAverage, sigma: seasonSigma },
  last_15: { average_allowed_per_48: last15Average, sigma: last15Sigma },
});

const league = {
  surface_availability: Object.fromEntries(
    [
      'play_types',
      'shot_zones',
      'shot_types',
      'assist_locations',
      'traditional',
      'rebound_types',
    ].map((base) => [
      base,
      {
        season: { status: 'available', unavailable_reason: null },
        last_15:
          base === 'play_types'
            ? { status: 'unavailable', unavailable_reason: 'provider_unsupported' }
            : base === 'shot_types'
              ? { status: 'missing', unavailable_reason: 'window_not_ready' }
              : { status: 'available', unavailable_reason: null },
      },
    ]),
  ),
  defense_sheet: {
    play_types: [
      leagueRow('Transition:PTS', 16.4, 1.4, 16.2, 1.2),
      leagueRow('Isolation:PTS', 8, 0.5, 8.1, 0.6),
      leagueRow('Postup:PTS', 11, 0.9, 11.4, 1.1),
      leagueRow('Handoff:PTS', 7.2, 0.7, 7.4, 0.8),
      leagueRow('Backcourt:PTS', 1.2, 0.2, 1.1, 0.2),
    ].map((row) => ({ ...row, last_15: null })),
    shot_zones: [
      leagueRow('Restricted Area:FGA', 21, 1.7, 21.2, 1.5),
      leagueRow('Above the Break 3:FGA', 11.5, 1, 11.7, 1),
    ],
    shot_types: [leagueRow('Catch and Shoot:FG3A', 15.5, 1.2, 15.3, 1.1)].map((row) => ({
      ...row,
      last_15: null,
    })),
    assist_locations: [
      leagueRow('AtRimAssists', 10, 0.8, 10.1, 0.9),
      leagueRow('Assists', 24, 1.4, 23.8, 1.3),
    ],
    traditional: [
      { ...leagueRow('OPP_REB', 46, 1.5, 46.2, 1.4), last_15: null },
      leagueRow('OPP_TOV', 13.8, 1.1, 13.5, 1),
      leagueRow('OPP_STL', 7.5, 0.8, 7.6, 0.7),
      leagueRow('OPP_BLK', 4.9, 0.6, 4.8, 0.5),
      leagueRow('OPP_PF', 19.5, 1.2, 19.2, 1.1),
    ],
    rebound_types: REBOUND_TYPES.map(({ key, average, sigma }) =>
      leagueRow(key, average, sigma, average, sigma),
    ),
  },
  defensive_columns: Object.fromEntries(
    [
      ['OPP_TOV', 13.1, 1.1, 13, 1],
      ['OPP_STL', 7.5, 0.8, 7.6, 0.7],
      ['OPP_BLK', 4.9, 0.6, 4.8, 0.5],
    ].map(([key, seasonAverage, seasonSigma, last15Average, last15Sigma]) => [
      key,
      {
        season: { average_per_48: seasonAverage, sigma: seasonSigma },
        last_15: { average_per_48: last15Average, sigma: last15Sigma },
      },
    ]),
  ),
};

// sigma_deviation is derived, never hand-picked: the boundary contract defines
// it as (share - leagueAverageShare) / populationSigma over ONE population per
// season/Base/slice, so every player sharing a (leagueAverageShare,
// populationSigma) pair here must be mathematically consistent with the others.
const dietShare = (
  key,
  seasonShare,
  leagueAverageShare,
  populationSigma,
  volumePerGame = 5.1,
  volumeUnit = 'possessions',
) => ({
  key,
  season: {
    share: seasonShare,
    volume: volumePerGame * 20,
    games_played: 20,
    volume_unit: volumeUnit,
    league_average_share: leagueAverageShare,
    sigma_deviation:
      Math.round(((seasonShare - leagueAverageShare) / populationSigma) * 1000) / 1000,
  },
});

// A shot type's twos and threes, each [share, league average, population
// sigma, attempts per game], as the backend's season.shot_values carries them.
const withShotValues = (fact, twos, threes) => {
  const value = ([share, leagueAverageShare, populationSigma, volumePerGame]) =>
    dietShare(
      fact.key,
      share,
      leagueAverageShare,
      populationSigma,
      volumePerGame,
      'field_goal_attempts',
    ).season;
  return { ...fact, season: { ...fact.season, shot_values: { 2: value(twos), 3: value(threes) } } };
};

const DEFENSIVE_MARKETS = ['TOV', 'STL', 'BLK', 'STKS'];
const COMPLETE_MARKETS = [
  'PTS',
  'REB',
  'AST',
  '3PM',
  'FGA',
  'FG2A',
  'FG3A',
  'PRA',
  'PA',
  'PR',
  'RA',
  'TOV',
  'STL',
  'BLK',
  'STKS',
];

const scoreWindow = (value, market, window, zeroComponents = false) => {
  if (DEFENSIVE_MARKETS.includes(market)) {
    return { components: { traditional: { value, thin: false } } };
  }
  if (zeroComponents) {
    return { components: {}, blend: null };
  }
  return {
    components:
      window === 'season'
        ? {
            play_types: { value: value - 0.01, thin: market === 'AST' },
            shot_zones: { value, thin: false },
          }
        : { shot_zones: { value, thin: market === 'AST' } },
    blend: { value, thin: market === 'AST' && window === 'last_15' },
  };
};

const scores = (markets, seasonValue, last15Value, { zeroMarkets = [] } = {}) =>
  Object.fromEntries(
    markets.map((market, index) => [
      market,
      {
        season: scoreWindow(
          seasonValue + index / 100,
          market,
          'season',
          zeroMarkets.includes(market),
        ),
        last_15: scoreWindow(
          last15Value + index / 100,
          market,
          'last_15',
          zeroMarkets.includes(market),
        ),
      },
    ]),
  );

export const matchupPayload = {
  game: {
    ...slateGame,
    away_team: { ...slateGame.away_team, targetable_player_count: 2 },
    home_team: { ...slateGame.home_team, targetable_player_count: 1 },
  },
  league,
  teams: [
    teamSheet(slateGame.away_team, [
      defenseRow(
        'Transition:PTS',
        'Transition PTS',
        ['PTS', 'PA', 'PR', 'PRA'],
        defenseValue(17.1, 9, 1.2, 24),
        defenseValue(14.8, -9, -1.1, 6),
      ),
      defenseRow(
        'Isolation:PTS',
        'Isolation PTS',
        ['PTS', 'PA', 'PR', 'PRA'],
        defenseValue(8.2, 2, 0.3, 16),
        defenseValue(9, 5, 0.6, 19),
      ),
      defenseRow(
        'Backcourt:PTS',
        'Backcourt PTS',
        ['PTS', 'PA', 'PR', 'PRA'],
        defenseValue(1.4, 4, 0.4, 18),
        defenseValue(1.3, 3, 0.3, 17),
      ),
    ]),
    teamSheet(
      slateGame.home_team,
      [
        defenseRow(
          'Transition:PTS',
          'Transition PTS',
          ['PTS', 'PA', 'PR', 'PRA'],
          defenseValue(18.4, 12, 1.4, 27),
          defenseValue(15.2, -8, -1.1, 5),
        ),
        defenseRow(
          'Isolation:PTS',
          'Isolation PTS',
          ['PTS', 'PA', 'PR', 'PRA'],
          defenseValue(8.1, 2, 0.4, 16),
          defenseValue(8.4, 4, 0.5, 18),
        ),
        defenseRow(
          'Postup:PTS',
          'Postup PTS',
          ['PTS', 'PA', 'PR', 'PRA'],
          defenseValue(12.1, 10, 1.2, 25),
          defenseValue(12.8, 11, 1.3, 26),
        ),
        defenseRow(
          'Backcourt:PTS',
          'Backcourt PTS',
          ['PTS', 'PA', 'PR', 'PRA'],
          defenseValue(1.6, 5, 0.5, 19),
          defenseValue(1.5, 4, 0.4, 18),
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
      canonical_id: 2544,
      name: 'LeBron James',
      team_id: slateGame.away_team.team_id,
      tricode: 'LAL',
      posted_markets: COMPLETE_MARKETS,
      provenance: {
        prizepicks: COMPLETE_MARKETS,
        underdog: ['PTS', 'TOV'],
        polymarket: ['PTS'],
        dabble: ['PTS'],
      },
      // Underdog posts his points a point under PrizePicks and Polymarket, whose
      // line leads; only PrizePicks numbers his rebounds.
      lines: {
        prizepicks: { PTS: 27.5, REB: 7.5 },
        underdog: { PTS: 26.5 },
        polymarket: { PTS: 27.5 },
        dabble: { PTS: 27.5 },
      },
      // Sportsbook quotes (parent statsplus#185 section 4). PTS: DraftKings and
      // BetMGM tie for the best Over at the shared 27.5 line, FanDuel's 26.5
      // is not compared with them. Five books, so the +1 expander shows.
      book_lines: {
        PTS: {
          as_of: '2026-10-21T21:04:11Z',
          closing: false,
          books: [
            {
              book: 'fanduel',
              line: 26.5,
              over: -135,
              under: 110,
              updated_at: '2026-10-21T21:03:02Z',
              best_over: false,
              best_under: false,
            },
            {
              book: 'betmgm',
              line: 27.5,
              over: -110,
              under: -120,
              updated_at: '2026-10-21T21:01:15Z',
              best_over: true,
              best_under: false,
            },
            {
              book: 'betrivers',
              line: 27.5,
              over: -115,
              under: -105,
              updated_at: '2026-10-21T21:00:40Z',
              best_over: false,
              best_under: true,
            },
            {
              book: 'draftkings',
              line: 27.5,
              over: -110,
              under: -115,
              updated_at: '2026-10-21T21:02:40Z',
              best_over: true,
              best_under: false,
            },
            {
              book: 'williamhill_us',
              line: 28.5,
              over: 105,
              under: -125,
              updated_at: '2026-10-21T21:04:11Z',
              best_over: false,
              best_under: false,
            },
          ],
        },
      },
      // Per-pick prices (parent statsplus#247). Polymarket prices the 27.5 headline:
      // its Over ties BetMGM and DraftKings, which win as sportsbooks, and its
      // Under beats every book. Underdog prices 26.5, a line no sportsbook or
      // headline shares with it, so its price is not compared. PrizePicks
      // never carries a price. Dabble's even line is −122 (statsplus#263),
      // which no book or market beats. Fliff stands for a provider the backend
      // adds before this build knows it: the decoder skips its prices.
      line_prices: {
        underdog: { PTS: { over: -112, under: -112 } },
        polymarket: { PTS: { over: -110, under: -102 } },
        dabble: { PTS: { over: -122, under: -122 } },
        fliff: { PTS: { over: -140, under: 110 } },
      },
      season_scoring: 25.4,
      last_10_minutes: [35, 36, 38, 34, 37, 36, 35, 39, 36, 37],
      diet_shares: {
        play_types: [
          // Current-matchup Transition population: mean .09, pstdev .075.
          // Above the sigma and volume floor: chip must render.
          dietShare('Transition', 0.19, 0.0925, 0.075),
          // Current-matchup Postup population: mean .05, pstdev .1.
          // Only -0.3 sigma from league average: chip stays hidden by sigma.
          dietShare('Postup', 0.02, 0.05, 0.1),
        ],
        // Current-matchup shot_zones Restricted Area population: mean .20, pstdev .06,
        // shared with Austin's and Tatum's facts below.
        shot_zones: [dietShare('Restricted Area', 0.27, 0.2, 0.06, 5.1, 'field_goal_attempts')],
        // Current-matchup shot_types Catch and Shoot population: mean .24, pstdev .10,
        // shared with Tatum's fact below.
        shot_types: [
          withShotValues(
            dietShare('Catch and Shoot', 0.36, 0.24, 0.1, 4.2, 'field_goal_attempts'),
            [0.03, 0.04, 0.02, 0.2],
            [0.33, 0.21, 0.08, 4],
          ),
        ],
        // Current-matchup assist_locations AtRimAssists population: mean .14, pstdev .12,
        // shared with Austin's and Tatum's facts below.
        assist_locations: [dietShare('AtRimAssists', 0.31, 0.14, 0.12, 1.1, 'assists')],
        // Rebound Types OffTwoPtRebounds population: mean .05, pstdev .04.
        // 1.75 sigma above league and 2.4 rebounds a game: the lean renders.
        rebound_types: [dietShare('OffTwoPtRebounds', 0.12, 0.05, 0.04, 2.4, 'rebounds')],
      },
      injury_badge_ref: null,
      scores: scores(COMPLETE_MARKETS, 0.12, -0.02),
    },
    {
      canonical_id: 1630559,
      name: 'Austin Reaves',
      team_id: slateGame.away_team.team_id,
      tricode: 'LAL',
      posted_markets: ['PTS', 'FG3A', 'STL', 'REB'],
      provenance: { prizepicks: ['PTS', 'FG3A', 'REB'], underdog: ['STL'] },
      // No book has numbered him yet, so the rail falls back to his Matchup Score.
      lines: {},
      book_lines: {},
      line_prices: {},
      season_scoring: 20.1,
      last_10_minutes: [32, 35, 34, 33, 31, 35, 36, 34, 35, 33],
      diet_shares: {
        // Above the display gate but intentionally posted for PTS, not FGA,
        // so market-tab chip scoping remains observable at the browser seam.
        play_types: [dietShare('Transition', 0.18, 0.0925, 0.075)],
        // Restricted Area is not an FG3A-compatible slice, and no shot-type
        // Diet fact exists, so FG3A has no contributing player evidence.
        // At +0.83 sigma against the same (mean .20, pstdev .06) population
        // LeBron and Tatum use, this chip clears the half-sigma display floor.
        shot_zones: [dietShare('Restricted Area', 0.25, 0.2, 0.06, 5.1, 'field_goal_attempts')],
        shot_types: [],
        // Above the sigma floor (against the shared mean .14, pstdev .12
        // assist_locations population), but under the assist-locations volume
        // floor (1/g): hidden by volume, not sigma.
        assist_locations: [dietShare('AtRimAssists', 0.35, 0.14, 0.12, 0.8, 'assists')],
        // 1.75 sigma above the same OffTwoPtRebounds population, but 0.6
        // rebounds a game is under the 1/g floor: the lean renders thin.
        rebound_types: [dietShare('OffTwoPtRebounds', 0.12, 0.05, 0.04, 0.6, 'rebounds')],
      },
      injury_badge_ref: 'injury-austin',
      scores: scores(['PTS', 'FG3A', 'STL', 'REB'], 0.24, 0.08, {
        zeroMarkets: ['FG3A'],
      }),
    },
    {
      canonical_id: 1628369,
      name: 'Jayson Tatum',
      team_id: slateGame.home_team.team_id,
      tricode: 'BOS',
      posted_markets: ['PTS', 'FGA', 'FG3A', 'REB', 'BLK'],
      provenance: { prizepicks: ['PTS', 'FGA', 'FG3A', 'REB'], underdog: ['BLK'] },
      lines: { prizepicks: { REB: 9.5 } },
      line_prices: {},
      // One side only (null Under) at a different line, from the closing snapshot.
      book_lines: {
        REB: {
          as_of: '2026-10-21T20:55:00Z',
          closing: true,
          books: [
            {
              book: 'draftkings',
              line: 8.5,
              over: -120,
              under: 100,
              updated_at: '2026-10-21T20:55:00Z',
              best_over: false,
              best_under: false,
            },
            {
              book: 'fanduel',
              line: 9.5,
              over: 135,
              under: null,
              updated_at: '2026-10-21T20:54:10Z',
              best_over: false,
              best_under: false,
            },
          ],
        },
      },
      season_scoring: 27.2,
      last_10_minutes: [36, 37, 35, 38, 34, 36, 39, 37, 36, 38],
      diet_shares: {
        play_types: [dietShare('Transition', 0.21, 0.0925, 0.075)],
        shot_zones: [dietShare('Restricted Area', 0.29, 0.2, 0.06, 5.1, 'field_goal_attempts')],
        // No stored twos/threes split: no chip on a shot type row.
        shot_types: [dietShare('Catch and Shoot', 0.39, 0.24, 0.1, 4.8, 'field_goal_attempts')],
        assist_locations: [dietShare('AtRimAssists', 0.33, 0.14, 0.12, 1.2, 'assists')],
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
            source_player_id: '5440',
            canonical_player_id: 1630559,
            source_player_name: 'Austin Reaves',
            team_id: slateGame.away_team.team_id,
            tricode: 'LAL',
            canonical_status: null,
            raw_status: 'Game-time decision',
            reason: 'Left calf soreness',
            source_url: 'https://www.rotowire.com/basketball/player/austin-reaves-5440',
          },
          {
            entry_id: 'injury-non-pool',
            source_player_id: '3929',
            canonical_player_id: 203114,
            source_player_name: 'Maxi Kleber',
            team_id: slateGame.away_team.team_id,
            tricode: 'LAL',
            canonical_status: 'Out',
            raw_status: 'Out',
            reason: 'Right foot recovery',
            source_url: 'https://www.rotowire.com/basketball/player/maxi-kleber-3929',
          },
          ...['Probable', 'Questionable', 'Doubtful'].map((status, index) => ({
            entry_id: `injury-${status.toLowerCase()}`,
            source_player_id: index === 2 ? null : `source-${index + 1}`,
            canonical_player_id: null,
            source_player_name: ['Gabe Vincent', 'Jarred Vanderbilt', 'Jordan Goodwin'][index],
            team_id: slateGame.away_team.team_id,
            tricode: 'LAL',
            canonical_status: status,
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
  as_of: {
    season: '2025-26',
    season_defense: '2026-01-14',
    last_15_defense: '2026-01-14',
    player_diets: '2026-01-15',
  },
};

// The live game after a Season Cutover to 2026-27 (crf04/statsplus#304): play
// types still serve 2025-26 while Synergy trails, and every open Last 15
// window covers the 6 games each team has played.
export const SYNERGY_TRAILING = {
  family: 'synergy',
  serving_season: '2025-26',
  rule: 'NBA has published 2026-27 and every team has played 10 games',
};
export const servingSeasonMatchupPayload = (() => {
  const candidate = JSON.parse(JSON.stringify(matchupPayload));
  candidate.as_of.season = '2026-27';
  Object.entries(candidate.league.surface_availability).forEach(([base, windows]) => {
    windows.season.season = base === 'play_types' ? '2025-26' : '2026-27';
    if (windows.last_15.status === 'available') {
      windows.last_15.season = '2026-27';
      windows.last_15.window_games = 6;
    }
  });
  candidate.trailing = [SYNERGY_TRAILING];
  return candidate;
})();

// Production LAC @ MIL 0022501082: every Season defense Surface published, no
// point-in-time Last 15, no archived DFS markets, canonical game-log players.
export const HISTORICAL_GAME_ID = '0022501082';
const HISTORICAL_CATEGORIES = ['PTS', 'REB', 'AST', 'FGA', 'FG3A', 'TOV'];
const HISTORICAL_LAST_15_MISSING = [
  'team_defense:play_types',
  'team_defense:shot_zones',
  'team_defense:shot_types',
  'team_defense:assist_locations',
  'team_defense:traditional',
];

/*
 * Slate Edges (crf04/statsplus#204), derived from the scheduled game's own
 * Matchup fixture by the contract's rules, so the home page and the Matchup
 * page read the same numbers: season PTS Blend (or the single component when
 * nothing is missing), effects at 8+ PPG by size, the spotlight from non-thin
 * Blends at 12+ PPG, and the play-type slice whose opponent reading pushes
 * hardest in the score's direction.
 */
const seasonPoints = (player) => {
  const season = player.scores?.PTS?.season;
  if (!season) return null;
  if (season.blend) return { value: season.blend.value, thin: season.blend.thin, blend: true };
  const components = Object.values(season.components || {});
  if ((season.missing_inputs || []).length > 0 || components.length !== 1) return null;
  return { value: components[0].value, thin: components[0].thin, blend: false };
};

const edgesFromMatchup = (matchup) => {
  const tricodeOf = (teamId) => matchup.teams.find((team) => team.team_id === teamId)?.tricode;
  const scored = matchup.players
    .map((player) => ({ player, points: seasonPoints(player) }))
    .filter(({ points }) => points !== null);
  const effects = scored
    .filter(({ player }) => player.season_scoring >= 8)
    .sort((a, b) => Math.abs(b.points.value) - Math.abs(a.points.value))
    .slice(0, 3)
    .map(({ player, points }) => ({
      canonical_id: player.canonical_id,
      name: player.name,
      tricode: player.tricode,
      season_scoring: player.season_scoring,
      value: points.value,
      thin: points.thin,
    }));
  const pick = (direction) => {
    const candidate = scored
      .filter(
        ({ player, points }) =>
          points.blend &&
          !points.thin &&
          player.season_scoring >= 12 &&
          points.value * direction > 0,
      )
      .sort((a, b) => (b.points.value - a.points.value) * direction)[0];
    if (!candidate) return null;
    const { player, points } = candidate;
    const opponent = matchup.teams.find((team) => team.team_id !== player.team_id);
    const readings = Object.fromEntries(
      (opponent.defense_sheet.play_types || []).map((row) => [row.key, row.season]),
    );
    const reason = [...(player.diet_shares.play_types || [])]
      .sort((a, b) => b.season.share - a.season.share)
      .slice(0, 2)
      .filter((row) => readings[`${row.key}:PTS`])
      .sort(
        (a, b) =>
          (readings[`${b.key}:PTS`].percent_vs_league_average -
            readings[`${a.key}:PTS`].percent_vs_league_average) *
          direction,
      )[0];
    const reading = readings[`${reason.key}:PTS`];
    return {
      game_id: matchup.game.game_id,
      canonical_id: player.canonical_id,
      name: player.name,
      tricode: player.tricode,
      opponent: tricodeOf(opponent.team_id),
      season_scoring: player.season_scoring,
      value: points.value,
      reason: {
        base: 'play_types',
        slice_key: reason.key,
        share: reason.season.share,
        league_average_share: reason.season.league_average_share,
        opponent_rank: reading.rank,
        opponent_percent_vs_league: reading.percent_vs_league_average,
      },
    };
  };
  return {
    effects,
    scores: scored.map(({ player, points }) => ({
      canonical_id: player.canonical_id,
      value: points.value,
    })),
    best: pick(1),
    toughest: pick(-1),
  };
};

export const slateEdgesPayload = (date, games) => {
  const scheduled = games.some((game) => game.game_id === matchupPayload.game.game_id)
    ? edgesFromMatchup(matchupPayload)
    : null;
  return {
    slate_date: date,
    games: games.map((game) => ({
      game_id: game.game_id,
      effects: game.game_id === matchupPayload.game.game_id ? scheduled.effects : [],
      scores: game.game_id === matchupPayload.game.game_id ? scheduled.scores : [],
    })),
    spotlight: { best: scheduled?.best ?? null, toughest: scheduled?.toughest ?? null },
  };
};

const historicalGame = {
  game_id: HISTORICAL_GAME_ID,
  away_team: {
    team_id: 1610612746,
    tricode: 'LAC',
    name: 'LA Clippers',
    targetable_player_count: 0,
  },
  home_team: {
    team_id: 1610612749,
    tricode: 'MIL',
    name: 'Milwaukee Bucks',
    targetable_player_count: 0,
  },
  scheduled_at: '2026-03-29T23:00:00Z',
  status: { state: 'final', label: 'Final' },
  classification: null,
  preseason: false,
};

const withoutPointInTimeWindow = (sheet) => {
  Object.values(sheet.defense_sheet).forEach((rows) =>
    rows.forEach((row) => {
      row.last_15 = null;
    }),
  );
  Object.values(sheet.defensive_columns).forEach((column) => {
    column.last_15 = null;
  });
  return sheet;
};

const historicalPlayTypes = (offset) => [
  defenseRow(
    'Transition:PTS',
    'Transition PTS',
    ['PTS', 'PA', 'PR', 'PRA'],
    defenseValue(17.9 + offset, 9, 1.2, 24),
    null,
  ),
  defenseRow(
    'Isolation:PTS',
    'Isolation PTS',
    ['PTS', 'PA', 'PR', 'PRA'],
    defenseValue(8.3 + offset, 3, 0.4, 17),
    null,
  ),
  defenseRow(
    'Postup:PTS',
    'Postup PTS',
    ['PTS', 'PA', 'PR', 'PRA'],
    defenseValue(12.4 + offset, 11, 1.3, 26),
    null,
  ),
];

const historicalLeague = () => {
  const scoped = JSON.parse(JSON.stringify(league));
  scoped.surface_availability = Object.fromEntries(
    Object.keys(scoped.surface_availability).map((base) => [
      base,
      {
        season: { status: 'available', unavailable_reason: null },
        last_15: { status: 'unavailable', unavailable_reason: 'no_point_in_time_snapshot' },
      },
    ]),
  );
  return withoutPointInTimeWindow(scoped);
};

const historicalScoreWindow = (value, category, available, missingInputs) => {
  if (DEFENSIVE_MARKETS.includes(category)) {
    // A withheld defensive score can still ship its component evidence, so the
    // component must not stand in for the score the contract did not complete.
    return available
      ? { components: { traditional: { value, thin: false } }, missing_inputs: [] }
      : { components: { traditional: { value: 0.91, thin: true } }, missing_inputs: missingInputs };
  }
  // A withheld offensive Blend still ships the components that were computable
  // and names the inputs the score contract did not get.
  return available
    ? {
        components: { shot_zones: { value, thin: false } },
        blend: { value, thin: false },
        missing_inputs: [],
      }
    : {
        components: { shot_zones: { value: 0.88, thin: true } },
        blend: null,
        missing_inputs: missingInputs,
      };
};

const historicalScores = (base, unavailable = []) =>
  Object.fromEntries(
    HISTORICAL_CATEGORIES.map((category, index) => [
      category,
      {
        season: historicalScoreWindow(
          base + index / 100,
          category,
          !unavailable.includes(category),
          // A category can only be missing inputs its own score contract needs.
          DEFENSIVE_MARKETS.includes(category)
            ? ['team_defense:traditional']
            : ['team_defense:play_types', 'player_diet:shot_zones'],
        ),
        last_15: historicalScoreWindow(0, category, false, HISTORICAL_LAST_15_MISSING),
      },
    ]),
  );

const historicalFocalLine = (team, minutes, stats) => {
  const away = historicalGame.away_team;
  const home = historicalGame.home_team;
  const isHome = team.team_id === home.team_id;
  return {
    game_id: HISTORICAL_GAME_ID,
    game_date: '2026-03-29',
    matchup: isHome ? `${home.tricode} vs. ${away.tricode}` : `${away.tricode} @ ${home.tricode}`,
    minutes,
    stats: Object.fromEntries(HISTORICAL_CATEGORIES.map((category) => [category, stats[category]])),
  };
};

const historicalParticipant = ({
  id,
  name,
  team,
  seasonScoring,
  minutes,
  focalStats,
  scoreBase,
  unavailable = [],
  dietShares = { play_types: [], shot_zones: [], shot_types: [], assist_locations: [] },
}) => ({
  canonical_id: id,
  name,
  team_id: team.team_id,
  tricode: team.tricode,
  player_source: 'game_logs',
  posted_markets: [],
  provenance: {},
  lines: {},
  book_lines: {},
  line_prices: {},
  stat_categories: HISTORICAL_CATEGORIES,
  focal_game_line: historicalFocalLine(team, minutes, focalStats),
  season_scoring: seasonScoring,
  last_10_minutes: [34, 33, 36, 32, 35, 34, 33, 36, 35, 34],
  diet_shares: dietShares,
  injury_badge_ref: null,
  scores: historicalScores(scoreBase, unavailable),
});

export const historicalMatchupPayload = {
  game: historicalGame,
  experience: {
    mode: 'historical',
    player_source: 'game_logs',
    sections: {
      schedule: {
        status: 'available',
        source: 'event_catalog',
        context: 'completed_season_catalog',
        unavailable_reason: null,
        // Immutable completed-season provenance, never a staleness signal.
        collected_at: '2026-03-30T04:10:00Z',
      },
      participants: {
        status: 'available',
        source: 'player_game_logs',
        context: 'completed_season',
        unavailable_reason: null,
      },
      season_defense: {
        status: 'available',
        source: 'team_matchup_publication',
        context: 'completed_season',
        unavailable_reason: null,
      },
      last_15_defense: {
        status: 'unavailable',
        source: null,
        context: null,
        unavailable_reason: 'no_point_in_time_snapshot',
      },
      injuries: {
        status: 'unavailable',
        source: null,
        context: null,
        unavailable_reason: 'no_pregame_snapshot',
      },
    },
  },
  league: historicalLeague(),
  teams: [
    withoutPointInTimeWindow(teamSheet(historicalGame.away_team, historicalPlayTypes(0))),
    withoutPointInTimeWindow(teamSheet(historicalGame.home_team, historicalPlayTypes(0.4), 1)),
  ],
  players: [
    historicalParticipant({
      id: 202695,
      name: 'Kawhi Leonard',
      team: historicalGame.away_team,
      seasonScoring: 21.4,
      minutes: 34.5,
      focalStats: { PTS: 24, REB: 5, AST: 7, FGA: 18, FG3A: 6, TOV: 2 },
      scoreBase: 0.18,
      dietShares: {
        play_types: [
          // Historical Transition population: mean .09, pstdev .10, shared
          // with Giannis's fact below. Above the sigma and volume floor:
          // chip must render.
          dietShare('Transition', 0.22, 0.09, 0.1),
          // Historical Postup population: mean .05, pstdev .15. At +0.6 sigma,
          // this chip clears the half-sigma display floor.
          dietShare('Postup', 0.14, 0.05, 0.15),
        ],
        // Historical shot_zones Restricted Area population: mean .21, pstdev
        // .06, shared with Giannis's fact below.
        shot_zones: [dietShare('Restricted Area', 0.28, 0.21, 0.06, 5.4, 'field_goal_attempts')],
        // Catch-and-shoot threes: +1.4 sigma at 4.1 a game, so its chip reads 32%,
        // not the whole shot type's 34%.
        shot_types: [
          withShotValues(
            dietShare('Catch and Shoot', 0.34, 0.24, 0.09, 4.4, 'field_goal_attempts'),
            [0.02, 0.03, 0.02, 0.3],
            [0.32, 0.21, 0.08, 4.1],
          ),
        ],
        // Historical assist_locations AtRimAssists population: mean .14,
        // pstdev .12, shared with Harden's and Giannis's facts below.
        assist_locations: [dietShare('AtRimAssists', 0.3, 0.14, 0.12, 1.2, 'assists')],
      },
    }),
    historicalParticipant({
      id: 201935,
      name: 'James Harden',
      team: historicalGame.away_team,
      seasonScoring: 19.8,
      minutes: 36.2,
      focalStats: { PTS: 19, REB: 4, AST: 11, FGA: 15, FG3A: 9, TOV: 4 },
      scoreBase: 0.26,
      dietShares: {
        play_types: [dietShare('Isolation', 0.24, 0.09, 0.125)],
        shot_zones: [dietShare('Above the Break 3', 0.31, 0.21, 0.08, 6.2, 'field_goal_attempts')],
        shot_types: [],
        assist_locations: [dietShare('AtRimAssists', 0.38, 0.14, 0.12, 1.9, 'assists')],
      },
    }),
    historicalParticipant({
      id: 1627826,
      name: 'Ivica Zubac',
      team: historicalGame.away_team,
      seasonScoring: 12.1,
      minutes: 27.8,
      focalStats: { PTS: 10, REB: 12, AST: 1, FGA: 8, FG3A: 0, TOV: 1 },
      scoreBase: 0.05,
      unavailable: ['PTS', 'TOV'],
    }),
    historicalParticipant({
      id: 203507,
      name: 'Giannis Antetokounmpo',
      team: historicalGame.home_team,
      seasonScoring: 30.2,
      minutes: 35.1,
      focalStats: { PTS: 33, REB: 14, AST: 6, FGA: 22, FG3A: 2, TOV: 3 },
      scoreBase: 0.21,
      dietShares: {
        play_types: [dietShare('Transition', 0.26, 0.09, 0.1)],
        shot_zones: [dietShare('Restricted Area', 0.41, 0.21, 0.06, 8.1, 'field_goal_attempts')],
        shot_types: [],
        assist_locations: [dietShare('AtRimAssists', 0.29, 0.14, 0.12, 1.4, 'assists')],
      },
    }),
    historicalParticipant({
      id: 203081,
      name: 'Damian Lillard',
      team: historicalGame.home_team,
      seasonScoring: 24.6,
      minutes: 33.4,
      focalStats: { PTS: 22, REB: 3, AST: 8, FGA: 17, FG3A: 11, TOV: 2 },
      scoreBase: 0.13,
    }),
  ],
  injuries: {
    status: 'unavailable',
    unavailable_reason: 'fetch_failed',
    retrieved_at: null,
    source: 'rotowire',
    source_url: 'https://www.rotowire.com/basketball/injury-report.php',
    teams: [],
  },
  freshness: {
    schedule: { status: 'fresh', retrieved_at: '2026-03-29T10:00:00Z' },
    pool: { status: 'unavailable', retrieved_at: null, providers: {} },
    // The reported production failure: no stats_tables publication marker.
    stats: { status: 'missing', retrieved_at: null },
    injuries: { status: 'unavailable', retrieved_at: null },
  },
};

// The same 2025-26 game served after a Season Cutover to 2026-27: its sections
// read the game's own season and nothing is trailing.
export const postCutoverHistoricalMatchupPayload = (() => {
  const candidate = JSON.parse(JSON.stringify(historicalMatchupPayload));
  candidate.as_of = { season: '2026-27' };
  Object.values(candidate.league.surface_availability).forEach((windows) => {
    windows.season.season = '2025-26';
  });
  candidate.experience.sections.season_defense.season = '2025-26';
  candidate.trailing = [];
  return candidate;
})();

const selectionLine = (date, matchup, minutes, values, deltas) => ({
  row_type: date === null ? 'average' : 'game',
  game_date: date,
  matchup: date === null ? null : matchup,
  minutes,
  stats: values,
  deltas,
});

const completeSelectionStats = {
  PTS: 31,
  REB: 8,
  AST: 9,
  '3PM': 4,
  FGA: 19,
  FG2A: 11,
  FG3A: 8,
  PRA: 48,
  PA: 40,
  PR: 39,
  RA: 17,
  TOV: 3,
  STL: 1,
  BLK: 1,
  STKS: 2,
};
const completeSelectionDeltas = {
  PTS: 0.083,
  REB: -0.012,
  AST: 0.031,
  '3PM': 0.011,
  FGA: 0.018,
  FG2A: 0.007,
  FG3A: 0.011,
  PRA: 0.102,
  PA: 0.114,
  PR: 0.071,
  RA: 0.019,
  TOV: 0.006,
  STL: -0.004,
  BLK: 0.003,
  STKS: -0.001,
};

export const selectionPayload = {
  player_id: 2544,
  h2h: {
    thin: false,
    rows: [
      selectionLine(
        '2025-12-25',
        'LAL vs. BOS',
        36,
        completeSelectionStats,
        completeSelectionDeltas,
      ),
      selectionLine(null, 'AVG', 36, completeSelectionStats, completeSelectionDeltas),
    ],
  },
  archetype: {
    thin: true,
    rows: [
      selectionLine(
        '2025-12-20',
        'DAL @ BOS',
        34,
        { ...completeSelectionStats, PTS: 28, FGA: 18, AST: 7, PRA: 43, PA: 35, PR: 36 },
        { ...completeSelectionDeltas, PTS: 0.041, FGA: 0.015, AST: -0.009, PRA: 0.02 },
      ),
      selectionLine(
        null,
        'AVG',
        34,
        { ...completeSelectionStats, PTS: 28, FGA: 18, AST: 7, PRA: 43, PA: 35, PR: 36 },
        { ...completeSelectionDeltas, PTS: 0.041, FGA: 0.015, AST: -0.009, PRA: 0.02 },
      ),
    ],
  },
};

export const austinSelectionPayload = {
  player_id: 1630559,
  h2h: { thin: false, rows: [] },
  archetype: {
    thin: true,
    rows: [
      selectionLine(
        '2025-12-18',
        'MIA @ BOS',
        33,
        { PTS: 22, FG3A: 7, STL: 1, REB: 4 },
        { PTS: 0.022, FG3A: 0.013, STL: -0.004, REB: 0.01 },
      ),
      selectionLine(
        null,
        'AVG',
        33,
        { PTS: 22, FG3A: 7, STL: 1, REB: 4 },
        { PTS: 0.022, FG3A: 0.013, STL: -0.004, REB: 0.01 },
      ),
    ],
  },
};

const historicalSelectionStats = { PTS: 21, REB: 6, AST: 5, FGA: 17, FG3A: 5, TOV: 2 };
const historicalSelectionDeltas = {
  PTS: 0.061,
  REB: 0.014,
  AST: -0.008,
  FGA: 0.012,
  FG3A: 0.009,
  TOV: -0.003,
};

// Pregame samples use games strictly before 2026-03-29; the focal game never
// appears in either table.
export const historicalSelectionPayload = {
  player_id: 202695,
  experience: {
    mode: 'historical',
    player_source: 'game_logs',
    focal_game: {
      game_id: HISTORICAL_GAME_ID,
      game_date: '2026-03-29',
      matchup: 'LAC @ MIL',
      minutes: 34.5,
      stats: { PTS: 24, REB: 5, AST: 7, FGA: 18, FG3A: 6, TOV: 2 },
    },
    samples: { context: 'pregame', excludes_focal_game: true },
    baseline: { context: 'completed_season', hindsight: true },
  },
  h2h: {
    thin: true,
    rows: [
      selectionLine(
        '2026-01-12',
        'LAC vs. MIL',
        33,
        historicalSelectionStats,
        historicalSelectionDeltas,
      ),
      selectionLine(null, 'AVG', 33, historicalSelectionStats, historicalSelectionDeltas),
    ],
  },
  archetype: {
    thin: false,
    rows: [
      selectionLine(
        '2026-02-08',
        'LAC @ BOS',
        35,
        historicalSelectionStats,
        historicalSelectionDeltas,
      ),
      selectionLine(null, 'AVG', 35, historicalSelectionStats, historicalSelectionDeltas),
    ],
  },
};

export const operationsPayload = {
  cycles: [
    {
      cycle_id: 'cycle-e2e-1',
      season: '2025-26',
      status: 'attention',
      cutoff: '2026-04-13T00:00:00Z',
    },
  ],
  streams: [
    {
      stream_key: 'traditional_opponent',
      provider: 'pbp',
      owner: 'railway',
      enabled: true,
      available: true,
      activation_status: 'active',
      freshness_rule: 'cutoff_current',
      publication_id: 'publication-e2e-1',
      coverage_cutoff: '2026-04-13T00:00:00Z',
      fence: 3,
      freshness_status: 'stale',
      age_seconds: 7200,
    },
    {
      stream_key: 'synergy:l15',
      provider: 'nba',
      owner: 'residential_collector',
      enabled: false,
      available: false,
      activation_status: 'unavailable',
      freshness_rule: 'unavailable',
      publication_id: null,
      coverage_cutoff: null,
      fence: null,
      freshness_status: 'unavailable',
      age_seconds: null,
    },
    {
      stream_key: 'play_types',
      provider: 'nba',
      owner: 'residential_collector',
      enabled: false,
      available: true,
      activation_status: 'inactive',
      freshness_rule: 'cutoff_current',
      publication_id: null,
      coverage_cutoff: null,
      fence: null,
      freshness_status: 'missing',
      age_seconds: null,
    },
  ],
  collectors: [
    {
      identity_id: 'collector-e2e-1',
      environment: 'production',
      revoked: false,
      last_seen_at: '2026-04-13T00:05:00Z',
      release_version: 'collector-1.2.3',
      release_checksum: 'a'.repeat(64),
    },
    {
      identity_id: 'collector-e2e-2',
      environment: 'production',
      revoked: false,
      last_seen_at: '2026-04-13T00:04:00Z',
      release_version: 'collector-1.1.0',
      release_checksum: 'b'.repeat(64),
    },
  ],
  alerts: [
    {
      alert_id: 'alert-e2e-1',
      severity: 'critical',
      code: 'cycle_attention',
      status: 'open',
    },
  ],
  reconciliation: [
    {
      item_id: 'reconciliation-e2e-1',
      season: '2025-26',
      kind: 'identity',
      reason: 'identity_unresolved',
      status: 'open',
    },
  ],
  validation: [
    {
      summary_id: 'validation-e2e-1',
      cycle_id: 'cycle-e2e-1',
      status: 'attention',
    },
  ],
  usage: [
    {
      collector_id: 'collector-e2e-1',
      poll_count: 85,
      envelope_count: 7,
      byte_count: 4096,
      concurrency_count: 1,
      limits: {
        poll_count: 100,
        envelope_count: 1000,
        byte_count: 52428800,
        concurrency_count: 1,
      },
      window_started_at: '2026-04-13T00:00:00Z',
      window_resets_at: '2026-04-14T00:00:00Z',
      retry_after_seconds: 3600,
      concurrency_retry_after_seconds: 30,
    },
  ],
  projections: {
    providers: [
      {
        provider: 'dabble',
        last_poll_at: '2026-04-13T00:00:00Z',
        last_changed_snapshot_at: '2026-04-13T00:00:00Z',
        freshness_seconds: 30,
        failure: { last_at: null, reason: null, consecutive: 0 },
        backoff: { active: false, until: null },
        active_count: 18,
        unresolved_count: 0,
      },
    ],
    active_count: 18,
    unresolved_count: 0,
    lease: { active: false, fence: 4, expires_at: null },
  },
  jobs: [
    {
      job_id: 'job-e2e-catalog-bootstrap',
      action: 'catalog.bootstrap',
      resource: '2025-26:athlete',
      status: 'succeeded',
      created_at: '2026-04-13T00:05:00Z',
      completed_at: '2026-04-13T00:06:00Z',
      error_code: null,
    },
    {
      job_id: 'job-e2e-1',
      action: 'composition.retry',
      resource: 'composition-e2e-1',
      status: 'failed',
      created_at: '2026-04-13T00:00:00Z',
      completed_at: '2026-04-13T00:02:00Z',
      error_code: 'provider_unavailable',
    },
    {
      job_id: 'job-e2e-collector-create',
      action: 'collector.create',
      resource: 'collector-e2e-2',
      status: 'succeeded',
      created_at: '2026-04-13T00:01:00Z',
      completed_at: '2026-04-13T00:01:30Z',
      error_code: null,
    },
  ],
};

const hasExactKeys = (body, required, optional = []) => {
  const keys = Object.keys(body).sort();
  const allowed = [...required, ...optional];
  return (
    required.every((key) => Object.hasOwn(body, key)) && keys.every((key) => allowed.includes(key))
  );
};
const validReason = (value) => typeof value === 'string' && value.trim().length >= 3;
const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9._:/-]{1,160}$/.test(value);
const validSeason = (value) => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
const validTimestamp = (value) =>
  typeof value === 'string' && value.includes('T') && !Number.isNaN(Date.parse(value));

const mutationContract = [
  {
    match: /^\/api\/admin\/collection\/seasons\/(\d{4}-\d{2})$/,
    action: 'season.activate',
    valid: (body) => hasExactKeys(body, ['reason']) && validReason(body.reason),
    response: (jobId, [, season]) => ({
      job_id: jobId,
      season,
      status: 'active',
      activated_at: '2026-04-13T00:10:00Z',
    }),
  },
  {
    match: /^\/api\/admin\/collection\/streams\/([^/]+)\/rollback$/,
    action: 'publication.rollback',
    valid: (body) =>
      hasExactKeys(body, ['reason'], ['expected_fence']) &&
      validReason(body.reason) &&
      (body.expected_fence === undefined ||
        (Number.isSafeInteger(body.expected_fence) && body.expected_fence >= 0)),
    response: (jobId, [, streamKey]) => ({
      job_id: jobId,
      publication_id: 'publication-e2e-rollback',
      stream_key: decodeURIComponent(streamKey),
      status: 'rollback',
    }),
  },
  {
    match: /^\/api\/admin\/collection\/streams\/([^/]+)\/activate$/,
    action: 'stream.activate',
    valid: (body) => hasExactKeys(body, ['reason']) && validReason(body.reason),
    response: (jobId, [, streamKey]) => ({
      job_id: jobId,
      stream_key: decodeURIComponent(streamKey),
      enabled: true,
    }),
  },
  {
    match: /^\/api\/admin\/collection\/compositions\/([^/]+)\/retry$/,
    action: 'composition.retry',
    valid: (body) => hasExactKeys(body, ['reason']) && validReason(body.reason),
    response: (jobId, [, compositionId]) => ({
      job_id: jobId,
      composition_job_id: decodeURIComponent(compositionId),
      status: 'queued',
      attempts: 2,
    }),
  },
  {
    match: /^\/api\/admin\/collection\/cycles\/start$/,
    action: 'cycle.start',
    valid: (body) =>
      hasExactKeys(body, ['manifest_id', 'reason']) &&
      validId(body.manifest_id) &&
      validReason(body.reason),
    response: (jobId) => ({ job_id: jobId, cycle_id: 'cycle-e2e-2', status: 'collecting' }),
  },
  {
    match: /^\/api\/admin\/collection\/repair$/,
    action: 'scoped_repair.start',
    valid: (body) =>
      hasExactKeys(body, ['stream_key', 'season', 'cutoff', 'reason']) &&
      validId(body.stream_key) &&
      validSeason(body.season) &&
      validTimestamp(body.cutoff) &&
      validReason(body.reason),
    response: (jobId) => ({
      job_id: jobId,
      composition_job_id: 'composition-e2e-repair',
      status: 'queued',
    }),
  },
  {
    match: /^\/api\/admin\/collection\/cycles\/([^/]+)\/finish$/,
    action: 'cycle.finish',
    valid: (body) =>
      hasExactKeys(body, ['status', 'reason']) &&
      ['complete', 'no_game', 'failed'].includes(body.status) &&
      validReason(body.reason),
    response: (jobId, [, cycleId]) => ({
      job_id: jobId,
      cycle_id: decodeURIComponent(cycleId),
      status: 'complete',
    }),
  },
  {
    match: /^\/api\/admin\/collection\/cycles\/([^/]+)\/not-applicable$/,
    action: 'cycle.not_applicable',
    valid: (body) =>
      hasExactKeys(body, ['stream_key', 'reason']) &&
      validId(body.stream_key) &&
      validReason(body.reason),
    response: (jobId, [, cycleId]) => ({
      job_id: jobId,
      cycle_id: decodeURIComponent(cycleId),
      stream_key: 'e2e-stream',
      status: 'governed',
    }),
  },
  {
    match: /^\/api\/admin\/collection\/bootstrap$/,
    action: 'bootstrap.start',
    valid: (body) =>
      hasExactKeys(body, ['season', 'catalog_type', 'cutoff', 'reason']) &&
      validSeason(body.season) &&
      validId(body.catalog_type) &&
      validTimestamp(body.cutoff) &&
      validReason(body.reason),
    response: (jobId) => ({ job_id: jobId, request_id: 'request-e2e-1', status: 'pending' }),
  },
  {
    match: /^\/api\/admin\/collection\/collectors\/([^/]+)\/revoke$/,
    action: 'collector.revoke',
    valid: (body) => hasExactKeys(body, ['reason']) && validReason(body.reason),
    response: (jobId, [, identityId]) => ({
      job_id: jobId,
      identity_id: decodeURIComponent(identityId),
      status: 'revoked',
    }),
  },
  {
    match: /^\/api\/admin\/collection\/collectors\/([^/]+)\/rotate$/,
    action: 'collector.rotate',
    valid: (body) =>
      hasExactKeys(body, ['reason'], ['overlap_seconds']) &&
      validReason(body.reason) &&
      (body.overlap_seconds === undefined ||
        (Number.isSafeInteger(body.overlap_seconds) && body.overlap_seconds >= 0)),
    response: (jobId, [, identityId]) => ({
      job_id: jobId,
      identity_id: decodeURIComponent(identityId),
      status: 'rotated',
    }),
  },
  {
    match: /^\/api\/admin\/collection\/reconciliation\/([^/]+)\/resolve$/,
    action: 'reconciliation.resolve',
    valid: (body) => hasExactKeys(body, ['reason']) && validReason(body.reason),
    response: (jobId, [, itemId]) => ({
      job_id: jobId,
      item_id: decodeURIComponent(itemId),
      status: 'resolved',
    }),
  },
];

// Two players whose seasons cannot be confused for one another: ranges taken
// from the wrong player's season are only detectable if the seasons differ.
export const curryGameLogs = gameLogs.map((log, index) => ({
  ...log,
  MATCHUP: log.MATCHUP.replace('LAL', 'GSW'),
  PTS: index === 0 ? 42 : 18,
}));

/*
 * Every player either Matchup publishes, which is this contract's whole
 * league. A Target's backtest reads league-wide rather than from the day's
 * opposing pool, so it needs a league to read.
 */
const leaguePlayers = [...matchupPayload.players, ...historicalMatchupPayload.players].filter(
  (player, index, all) =>
    all.findIndex((other) => other.canonical_id === player.canonical_id) === index,
);

/*
 * Each of them has a season in the game-log route too, because a backtest row
 * and the Log Workspace that row hands off to have to be reading the same
 * games. It is the shared season rewritten as that player's: their team, and
 * their own scoring, so two rows of one backtest table can never be confused.
 *
 * The shared season is LeBron's, and every other player's is shifted from it
 * by the whole points their season scoring differs by. Keep his own scoring
 * rounding to this number: the Log Workspace journeys read his logs unshifted
 * and assert the points cell they arrive with.
 */
const SHARED_SEASON_SCORING = 25;

const leagueSeason = (player) =>
  gameLogs.map((log) => ({
    ...log,
    MATCHUP: log.MATCHUP.replace('LAL', player.tricode),
    PTS: log.PTS + Math.round(player.season_scoring) - SHARED_SEASON_SCORING,
  }));

const seasonsByPlayer = {
  'Stephen Curry': curryGameLogs,
  ...Object.fromEntries(leaguePlayers.map((player) => [player.name, leagueSeason(player)])),
};

// The game-log route names each player by NBA person id, for their headshot.
const playerIdsByName = {
  'Stephen Curry': 201939,
  ...Object.fromEntries(leaguePlayers.map((player) => [player.name, player.canonical_id])),
};

const curryBook = (book, line, over, under) => ({
  book,
  line,
  over,
  under,
  updated_at: '2026-10-21T15:00:00Z',
  best_over: false,
  best_under: false,
});

/*
 * His next game's posted lines (crf04/statsplus#238); null for everyone else.
 * Its sources disagree (crf04/statsplus#274): most post 26.5 points and 4.5
 * threes, the line `lines` names, while BetRivers posts 27.5 points and two
 * books post 3.5 threes, which one of his two logged games clears. Hard Rock
 * is a book the app has no name for.
 */
const postedLinesByName = {
  'Stephen Curry': {
    game_id: '0022600012',
    game_date: '2026-10-21',
    matchup: 'GSW vs LAL',
    lines: {
      PTS: { value: 26.5, provider: 'dabble' },
      '3PM': { value: 4.5, provider: 'novig' },
    },
    provider_lines: {
      dabble: { PTS: 26.5 },
      novig: { '3PM': 4.5 },
      underdog: { PTS: 26.5, '3PM': 4.5 },
    },
    line_prices: {
      dabble: { PTS: { over: -122, under: -122 } },
      novig: { '3PM': { over: -105, under: -115 } },
      underdog: { PTS: { over: -112, under: -112 } },
    },
    book_lines: {
      PTS: {
        as_of: '2026-10-21T15:00:00Z',
        closing: false,
        books: [
          curryBook('draftkings', 26.5, -110, -115),
          curryBook('fanduel', 26.5, -114, -106),
          curryBook('betrivers', 27.5, 102, -128),
        ],
      },
      '3PM': {
        as_of: '2026-10-21T15:00:00Z',
        closing: false,
        books: [
          curryBook('draftkings', 3.5, -165, 130),
          curryBook('fanduel', 4.5, 110, -140),
          curryBook('hardrockbet', 3.5, -160, null),
        ],
      },
    },
  },
};

// The real endpoint narrows the season by the self filters it is sent. The
// contract has to narrow too, or a test cannot tell a filtered result set from
// the unfiltered season the Self Filters ranges are supposed to come from.
const applySelfFilters = (logs, url) =>
  [...url.searchParams].reduce((remaining, [key, value]) => {
    const stat = key.match(/^self_filters\[(.+)\]$/)?.[1];
    if (!stat) return remaining;
    const [min, max] = value.split(',').map(Number);
    return remaining.filter((log) => log[stat] >= min && log[stat] <= max);
  }, logs);

// The real endpoint reads date_filter and date_to as an inclusive calendar range
// (YYYY-MM-DD strings order as dates), so a Filter Set's end date has to cut
// the games here too or a journey cannot tell a range from a start date.
const applyDateRange = (logs, url) => {
  const from = url.searchParams.get('date_filter');
  const to = url.searchParams.get('date_to');
  return logs.filter((log) => (!from || log.GAME_DATE >= from) && (!to || log.GAME_DATE <= to));
};

// The real endpoint restricts the read to games against one specific opponent
// when it is sent a tricode. The contract has to restrict too, or a journey
// cannot tell a Filter Set fixed to one opponent from the whole season.
const applyOpponentTricode = (logs, url) => {
  const tricode = url.searchParams.get('opponent_tricode');
  if (!tricode) return logs;
  return logs.filter((log) => log.MATCHUP.endsWith(` ${tricode}`));
};

/**
 * The Traditional Opposing Team Profile, per-48 and ranked ascending so that
 * rank 1 means the fewest allowed.
 *
 * The rebound split is canonical: the offensive and defensive values sum to the
 * total the profile already published, so the three rows can never contradict
 * each other on screen. The two splits sit on opposite sides of the league
 * average, which keeps the comparison column honest in both directions.
 */
const traditionalTeamStats = {
  OPP_PTS: 112,
  OPP_PTS_RANK: 18,
  OPP_OREB: 10.62,
  OPP_OREB_RANK: 7,
  OPP_OREB_vs_avg_pct: -4.75,
  OPP_DREB: 33.48,
  OPP_DREB_RANK: 24,
  OPP_DREB_vs_avg_pct: 3.86,
  OPP_REB: 44.1,
  OPP_REB_RANK: 19,
  OPP_REB_vs_avg_pct: 1.72,
};

// A Target is unique within an account by opponent plus its Qualifier set, so
// the canonical form ignores the order the Qualifiers were typed in.
const canonicalQualifiers = (qualifiers) =>
  qualifiers
    .map((q) => `${q.base}:${q.slice_key}:${q.comparator}:${q.threshold}`)
    .sort()
    .join('|');

/*
 * The backend derives and stores the Target title; the frontend only ever
 * displays it. So this stands in for the backend's derivation and deliberately
 * keeps its own copy of the slice wording and the share format: if the page's
 * title preview ever drifts from the backend's, a journey has to be able to
 * see it. See crf04/statsplus
 * docs/adr/0001-targets-store-player-criteria-not-team-readings.md.
 */
const BACKEND_BASE_SLICE_LABELS = {
  shot_zones: {
    'Restricted Area': 'Restricted area',
    'In The Paint (Non-RA)': 'Paint (non-RA)',
    'Mid-Range': 'Mid-range',
    'Corner 3': 'Corner 3',
    'Above the Break 3': 'Above-break 3',
  },
  play_types: {
    // Deliberately not the page's wording for this slice. The title is the
    // backend's to derive, so a surface that showed its own preview where it
    // promised the stored title would read 'Transition' here and be wrong.
    Transition: 'Transition offense',
    Isolation: 'Isolation',
    PRBallHandler: 'P&R ball handler',
    PRRollMan: 'P&R roll man',
    Spotup: 'Spot up',
    Cut: 'Cut',
    Handoff: 'Handoff',
    OffScreen: 'Off screen',
    Postup: 'Post up',
    OffRebound: 'Putback',
  },
  shot_types: {
    'Catch and Shoot': 'Catch & shoot',
    Pullups: 'Pull-up',
    'Less Than 10 ft': 'Inside 10 ft',
  },
  assist_locations: {
    Arc3Assists: 'Arc 3 assists',
    Corner3Assists: 'Corner 3 assists',
    AtRimAssists: 'At-rim assists',
    ShortMidRangeAssists: 'Short mid assists',
    LongMidRangeAssists: 'Long mid assists',
  },
};

const BACKEND_SLICE_LABELS = Object.assign({}, ...Object.values(BACKEND_BASE_SLICE_LABELS));

// A slice is a slice of one base: 'Transition' is a play type and nothing
// else, and an inherited key like `toString` is a slice of nothing.
const knownSlice = (base, sliceKey) =>
  Object.hasOwn(BACKEND_BASE_SLICE_LABELS, base) &&
  Object.hasOwn(BACKEND_BASE_SLICE_LABELS[base], sliceKey);

const backendShare = (share) => {
  const percent = (share * 100).toFixed(1);
  return `${percent.endsWith('.0') ? percent.slice(0, -2) : percent}%`;
};

const backendTargetTitle = ({ opponent, qualifiers }) =>
  `${opponent} vs ${qualifiers
    .map(
      (qualifier) =>
        `${BACKEND_SLICE_LABELS[qualifier.slice_key] || qualifier.slice_key} ${
          qualifier.comparator === 'at_or_below' ? '≤' : '≥'
        } ${backendShare(qualifier.threshold)}`,
    )
    .join(', ')}`;

const TARGET_LIMIT = 50;

/*
 * Resolution composes the Slate for a date with the Matchup for each game a
 * Target's opponent plays, so this contract resolves the account's Targets
 * against its own two Matchups rather than replaying a canned answer. A
 * journey then sees the shares, thin flags and Defense Sheet readings the
 * Matchup page shows for the same game, which is the agreement the backend
 * composes for. The scheduled game resolves against the stored Player Pool
 * and the completed one against canonical game-log participants.
 */
const HISTORICAL_SLATE_DATE = '2026-03-29';
const DEFAULT_SLATE_DATE = '2026-01-15';

// The Slate Date the backend assumes when a request names none: today in US Eastern.
const todaySlateDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

// Seasons whose game logs can be read. The default one is what the real endpoint reads when
// season_filter is omitted; the other is a single-game season so a switch is visible in results.
export const SEASONS = { seasons: ['2026-27', '2025-26'], default_season: '2025-26' };
// 2026-27 holds one game per player: that player's latest row, 13 points higher (LeBron: 44).
const applySeason = (logs, url) =>
  url.searchParams.get('season_filter') === '2026-27'
    ? [{ ...logs[0], GAME_DATE: '2026-10-20', PTS: logs[0].PTS + 13 }]
    : logs;

const RESOLVABLE_SLATES = {
  [DEFAULT_SLATE_DATE]: {
    matchup: matchupPayload,
    availability: {
      status: 'available',
      source: 'player_pool',
      context: 'current',
      unavailable_reason: null,
    },
  },
  [HISTORICAL_SLATE_DATE]: {
    matchup: historicalMatchupPayload,
    availability: {
      status: 'available',
      source: 'game_logs',
      context: 'completed_season',
      unavailable_reason: null,
    },
  },
};

const IDLE_AVAILABILITY = {
  status: 'unavailable',
  source: null,
  context: null,
  unavailable_reason: 'opponent_idle',
};

// A row key is the slice on its own when the slice and the statistic share a
// name, and `slice:stat` otherwise.
const namesSlice = (rowKey, sliceKey) => rowKey === sliceKey || rowKey.startsWith(`${sliceKey}:`);

const resolvedContext = (qualifier, sheet, sheetLeague) => {
  const leagueRows = Object.fromEntries(
    (sheetLeague.defense_sheet[qualifier.base] || []).map((row) => [row.key, row]),
  );
  return {
    base: qualifier.base,
    slice_key: qualifier.slice_key,
    label: BACKEND_SLICE_LABELS[qualifier.slice_key] || qualifier.slice_key,
    // The window availability is the Matchup's own, so a Base that publishes
    // no Last 15 carries no Last 15 value here either.
    availability: sheetLeague.surface_availability[qualifier.base],
    metrics: (sheet[qualifier.base] || [])
      .filter((row) => namesSlice(row.key, qualifier.slice_key))
      .map((row) => ({
        key: row.key,
        label: row.label,
        markets: row.markets,
        opponent: { season: row.season, last_15: row.last_15 },
        league: {
          season: leagueRows[row.key]?.season || null,
          last_15: leagueRows[row.key]?.last_15 || null,
        },
      })),
  };
};

// The Matchup Score's own thin floors: every fact in the Base needs the games,
// and the Base's volume per game has to clear its floor.
const THIN_MIN_GAMES = 5;
const THIN_MIN_VOLUME_PER_GAME = {
  play_types: 1,
  shot_zones: 1,
  shot_types: 4,
  assist_locations: 1,
};

const thinBase = (base, facts) =>
  facts.some((fact) => fact.season.games_played < THIN_MIN_GAMES) ||
  facts.reduce((total, fact) => total + fact.season.volume / fact.season.games_played, 0) <
    THIN_MIN_VOLUME_PER_GAME[base];

const resolvedFit = (qualifiers, player) => {
  const shares = [];
  let thin = false;
  for (const qualifier of qualifiers) {
    const facts = player.diet_shares[qualifier.base] || [];
    const fact = facts.find((item) => item.key === qualifier.slice_key);
    // No stored share for the slice is not a share of zero, so the player is
    // unjudged rather than judged to fit.
    if (!fact) return null;
    const meets =
      qualifier.comparator === 'at_or_below'
        ? fact.season.share <= qualifier.threshold
        : fact.season.share >= qualifier.threshold;
    if (!meets) return null;
    shares.push({
      base: qualifier.base,
      slice_key: qualifier.slice_key,
      share: fact.season.share,
      league_average_share: fact.season.league_average_share,
    });
    thin = thin || thinBase(qualifier.base, facts);
  }
  return {
    canonical_id: player.canonical_id,
    name: player.name,
    team_id: player.team_id,
    tricode: player.tricode,
    posted_markets: player.posted_markets,
    injury_badge_ref: player.injury_badge_ref,
    season_scoring: player.season_scoring,
    thin,
    shares,
  };
};

const teamReference = (side) => ({
  team_id: side.team_id,
  tricode: side.tricode,
  name: side.name,
});

// Opponent season logs are shared by roster, Conditions and games-considered.
// An omitted defender line means he sat out that team game: zero minutes.
const CONDITION_ROSTERS = {
  ATL: [{ player_id: 203991, name: 'Clint Capela', games_played: 3, average_minutes: 28 }],
  BOS: [{ player_id: 204001, name: 'Kristaps Porzingis', games_played: 2, average_minutes: 30 }],
};
const CONDITION_GAMES = {
  ATL: ['LAL', 'BOS', 'LAC', 'MIL'].map((against, index) => ({
    date: '2025-01-10',
    against,
    minutes: index === 1 ? {} : { 203991: 28 },
  })),
  BOS: [{ date: DEFAULT_SLATE_DATE, against: 'LAL', minutes: {} }],
};
const conditionCounts = (target, game) => {
  const condition = target.conditions;
  if (!condition) return true;
  if ((condition.from && game.date < condition.from) || (condition.to && game.date > condition.to))
    return false;
  if (!condition.defender) return true;
  const minutes = game.minutes[condition.defender.player_id] || 0;
  return condition.defender.comparator === 'under'
    ? minutes < condition.defender.minutes
    : minutes >= condition.defender.minutes;
};
const opponentGames = (opponent) =>
  CONDITION_GAMES[opponent] || [
    ...new Map(
      leaguePlayers.flatMap((player) =>
        (seasonsByPlayer[player.name] || [])
          .filter((log) => log.MATCHUP.endsWith(` ${opponent}`))
          .map((log) => [
            `${player.tricode}-${log.GAME_DATE}`,
            { date: log.GAME_DATE, against: player.tricode, minutes: {} },
          ]),
      ),
    ).values(),
  ];
const countsSeasonLog = (target, log, player) => {
  const game = opponentGames(target.opponent).find(
    (item) => item.date === log.GAME_DATE && item.against === player.tricode,
  );
  if (!conditionCounts(target, game || { date: log.GAME_DATE, minutes: {} })) return false;
  const threshold = target.conditions?.player_minutes;
  return (
    threshold === null ||
    threshold === undefined ||
    (typeof log.MIN === 'number' && Number.isFinite(log.MIN) && log.MIN > threshold)
  );
};
const validSlateDate = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
// A Defender is validated against the Backtest's season, which is always one
// with games here: the other is refused before validation.
const validFixtureConditions = (conditions, opponent) => {
  if (conditions === undefined || conditions === null) return true;
  if (typeof conditions !== 'object' || Array.isArray(conditions)) return false;
  const { from, to, defender, player_minutes: playerMinutes } = conditions;
  if (
    (from !== null && !validSlateDate(from)) ||
    (to !== null && !validSlateDate(to)) ||
    (from && to && from > to)
  )
    return false;
  const validDefender =
    defender === null ||
    (defender &&
      (CONDITION_ROSTERS[opponent] || []).some(
        (player) => player.player_id === defender.player_id,
      ) &&
      ['under', 'at_least'].includes(defender.comparator) &&
      typeof defender.minutes === 'number' &&
      Number.isFinite(defender.minutes) &&
      defender.minutes >= 0 &&
      defender.minutes <= 48);
  const validPlayerMinutes =
    playerMinutes === null ||
    playerMinutes === undefined ||
    (Number.isInteger(playerMinutes) && playerMinutes >= 0 && playerMinutes <= 48);
  return validDefender && validPlayerMinutes;
};
const canonicalFixtureConditions = (conditions) =>
  conditions === undefined || conditions === null
    ? null
    : { ...conditions, player_minutes: conditions.player_minutes ?? null };

const resolveTargets = (date, targets) => {
  const slate = RESOLVABLE_SLATES[date];
  const live = [];
  const idle = [];
  targets.forEach((target) => {
    const game = slate?.matchup.game;
    const sides =
      game?.away_team.tricode === target.opponent
        ? [game.away_team, game.home_team]
        : game?.home_team.tricode === target.opponent
          ? [game.home_team, game.away_team]
          : null;
    if (!sides) {
      idle.push({
        target,
        game: null,
        context: [],
        availability: IDLE_AVAILABILITY,
        players: [],
      });
      return;
    }
    const [opponent, opposing] = sides;
    const sheet = slate.matchup.teams.find(
      (team) => team.team_id === opponent.team_id,
    ).defense_sheet;
    live.push({
      target,
      game: {
        game_id: game.game_id,
        scheduled_at: game.scheduled_at,
        status: game.status,
        // Which side is at home is the game's; which one the Target is about
        // is the Target's.
        away: teamReference(game.away_team),
        home: teamReference(game.home_team),
        opponent: teamReference(opponent),
        opposing_team: teamReference(opposing),
      },
      context: target.qualifiers.map((qualifier) =>
        resolvedContext(qualifier, sheet, slate.matchup.league),
      ),
      availability: slate.availability,
      // The Matchup orders its players by season scoring descending, so
      // keeping its order is that ordering.
      players: slate.matchup.players
        .filter((player) => player.team_id !== opponent.team_id)
        .filter(() =>
          conditionCounts(
            target,
            opponentGames(target.opponent).find((item) => item.date === date) || {
              date,
              minutes: {},
            },
          ),
        )
        .map((player) => resolvedFit(target.qualifiers, player))
        .filter(Boolean),
    });
  });
  // Live Targets first, then idle, each keeping the list's newest-first order.
  return { slate_date: date, targets: [...live, ...idle] };
};

/*
 * The backtest is season-to-date and league-wide rather than day-scoped: every
 * player the league publishes whose Diet meets every Qualifier and is not
 * thin, and the games in their season played against the Target's opponent. A
 * Target whose opponent is idle today still has one.
 *
 * The columns are the Target defaults for each Qualifier, deduped in Qualifier
 * order. Every figure is read off the same game log the Log Workspace serves,
 * so a row and the handoff it links to cannot disagree.
 */
const SLICE_MARKETS = {
  play_types: ['PTS', 'FGA', 'PTS/36', 'FGA/36'],
  assist_locations: ['AST', 'AST/36'],
  shot_types: ['PTS', 'PTS/36', 'FGA', 'FGA/36'],
};

const THREE_POINT_SLICES = ['Corner 3', 'Above the Break 3'];
const TWO_POINT_SHOT_ZONE_STATS = ['PTS', 'PTS/36', 'FG2A', 'FG2A/36'];
const THREE_POINT_SHOT_ZONE_STATS = ['PTS', 'PTS/36', '3PA', '3PA/36'];

const sliceMarkets = (qualifier) =>
  qualifier.base === 'shot_zones'
    ? THREE_POINT_SLICES.includes(qualifier.slice_key)
      ? THREE_POINT_SHOT_ZONE_STATS
      : TWO_POINT_SHOT_ZONE_STATS
    : SLICE_MARKETS[qualifier.base] || ['PTS'];

// Box-score proxies: what a game log holds is the closest thing to a slice.
const MARKET_STATS = {
  PTS: (log) => log.PTS,
  AST: (log) => log.AST,
  '3PM': (log) => log.FG3M,
  FGA: (log) => log.FGA,
  FG2A: (log) =>
    Number.isFinite(log.FGA) && Number.isFinite(log.FG3A) ? log.FGA - log.FG3A : null,
  '3PA': (log) => log.FG3A,
  PA: (log) => log.PTS + log.AST,
  PR: (log) => log.PTS + log.REB,
  RA: (log) => log.REB + log.AST,
  PRA: (log) => log.PTS + log.REB + log.AST,
};

const per36 = (value, minutes) =>
  Number.isFinite(value) && Number.isFinite(minutes) && minutes > 0 ? (value / minutes) * 36 : null;

Object.assign(MARKET_STATS, {
  'PTS/36': (log) => per36(MARKET_STATS.PTS(log), log.MIN),
  'FGA/36': (log) => per36(MARKET_STATS.FGA(log), log.MIN),
  'FG2A/36': (log) => per36(MARKET_STATS.FG2A(log), log.MIN),
  '3PA/36': (log) => per36(MARKET_STATS['3PA'](log), log.MIN),
  'AST/36': (log) => per36(MARKET_STATS.AST(log), log.MIN),
});

const seasonAverage = (season, market) => {
  if (market.endsWith('/36')) {
    const productionValues = season.map((log) => MARKET_STATS[market.slice(0, -3)](log));
    const minutesValues = season.map((log) => log.MIN);
    if (
      !productionValues.every(Number.isFinite) ||
      !minutesValues.every(Number.isFinite) ||
      productionValues.length === 0
    )
      return null;
    const production = productionValues.reduce((total, value) => total + value, 0);
    const minutes = minutesValues.reduce((total, value) => total + value, 0);
    return per36(production, minutes);
  }
  const values = season.map((log) => MARKET_STATS[market](log));
  if (!values.every(Number.isFinite) || values.length === 0) return null;
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
};

const boxLine = (log) => ({
  points: log.PTS,
  rebounds: log.REB,
  assists: log.AST,
  minutes: log.MIN,
  field_goals_made: log.FGM,
  field_goals_attempted: log.FGA,
  threes_made: log.FG3M,
  threes_attempted: log.FG3A,
  free_throws_made: log.FTM,
  free_throws_attempted: log.FTA,
  steals: log.STL,
  blocks: log.BLK,
  turnovers: log.TOV,
  offensive_rebounds: log.OREB,
  defensive_rebounds: log.DREB,
  fouls: log.PF,
});
const seasonTotals = (season) =>
  season
    .map(boxLine)
    .reduce(
      (totals, line) =>
        Object.fromEntries(
          Object.entries(line).map(([field, value]) => [field, (totals[field] || 0) + value]),
        ),
      {},
    );

const backtestPlayer = (target, statColumns, player) => {
  const fit = resolvedFit(target.qualifiers, player);
  // A thin Diet is excluded from the longer view rather than flagged in it, so
  // the sample is not polluted by a diet nobody should lean on.
  if (!fit || fit.thin) return null;
  const season = seasonsByPlayer[player.name] || [];
  const games = season.filter(
    (log) => log.MATCHUP.endsWith(` ${target.opponent}`) && countsSeasonLog(target, log, player),
  );
  if (games.length === 0) return null;
  return {
    canonical_id: player.canonical_id,
    name: player.name,
    team_id: player.team_id,
    tricode: player.tricode,
    season_scoring: player.season_scoring,
    shares: fit.shares,
    season_totals: seasonTotals(season),
    season_games: season.length,
    season_averages: Object.fromEntries(
      statColumns.map((market) => [market, seasonAverage(season, market)]),
    ),
    games: games.map((log) => ({
      // The contract's game logs carry no game id of their own, so one is
      // composed from the player and the day they played.
      game_id: `${player.canonical_id}-${log.GAME_DATE}`,
      game_date: log.GAME_DATE,
      matchup: log.MATCHUP,
      minutes: log.MIN,
      line: boxLine(log),
      stats: Object.fromEntries(statColumns.map((market) => [market, MARKET_STATS[market](log)])),
    })),
  };
};

/*
 * The backend's arithmetic over every listed game, so the Lab and the saved
 * detail read the same figures: per market, the mean signed distance from
 * each player's own season average and the share of games at or above it. A
 * market with no game to average has no figure.
 */
export const backtestSummary = (players, statColumns) => {
  const games = players.flatMap((player) => player.games.map((game) => ({ player, game })));
  return {
    players: players.length,
    games: games.length,
    columns: Object.fromEntries(
      statColumns.map((market) => {
        const differences = games
          .filter(
            ({ player, game }) =>
              Number.isFinite(game.stats[market]) &&
              Number.isFinite(player.season_averages[market]),
          )
          .map(({ player, game }) => game.stats[market] - player.season_averages[market]);
        if (differences.length === 0) {
          return [market, { mean_difference: null, over_average_share: null }];
        }
        return [
          market,
          {
            mean_difference:
              Math.round(
                (differences.reduce((total, value) => total + value, 0) / differences.length) * 100,
              ) / 100,
            over_average_share:
              Math.round(
                (differences.filter((value) => value >= 0).length / differences.length) * 1000,
              ) / 1000,
          },
        ];
      }),
    ),
  };
};

/*
 * A Backtest reads 2025-26 or 2026-27. With no season named it reads the
 * 2025-26 default, whatever is published, so the reason is `default`; a named
 * season is `requested`. The published season here is 2025-26, and nothing is
 * published for 2026-27, so naming it is refused as `season_unavailable`
 * rather than read as an empty Backtest. Anything else is `400`.
 */
const PUBLISHED_SEASON = '2025-26';
const DEFAULT_SEASON = '2025-26';
const UNPUBLISHED_SEASON = '2026-27';
const invalidSeason = (season) =>
  season !== undefined && season !== DEFAULT_SEASON && season !== UNPUBLISHED_SEASON;
const invalidSeasonResponse = {
  status: 400,
  json: {
    error: {
      code: 'invalid_input',
      message: `season must be ${DEFAULT_SEASON} or ${UNPUBLISHED_SEASON}.`,
    },
  },
};
const seasonUnavailableResponse = {
  status: 503,
  // The API is a different origin, so the browser shows the reference only
  // when the backend exposes the header, as it does in production.
  headers: {
    'X-Request-ID': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f',
    'Access-Control-Expose-Headers': 'X-Request-ID',
  },
  json: {
    error: {
      code: 'season_unavailable',
      message: `The ${UNPUBLISHED_SEASON} season is unavailable: no retained player_game_logs Publication can be read.`,
      details: {
        season: UNPUBLISHED_SEASON,
        published_season: PUBLISHED_SEASON,
        stream: 'player_game_logs',
      },
    },
  },
};
// The response for a season no route can read, or null for a readable one.
const seasonRefusal = (season) =>
  invalidSeason(season)
    ? invalidSeasonResponse
    : season === UNPUBLISHED_SEASON
      ? seasonUnavailableResponse
      : null;
const seasonMetadata = (season) => ({
  season: season ?? DEFAULT_SEASON,
  season_reason: season === undefined ? 'default' : 'requested',
  published_season: PUBLISHED_SEASON,
});

const backtestTarget = (target, season) => {
  const statColumns = [...new Set(target.qualifiers.flatMap(sliceMarkets))];
  const players = leaguePlayers
    .map((player) => backtestPlayer(target, statColumns, player))
    .filter(Boolean)
    // Season scoring descending, as every player list the product shows is.
    .sort((first, second) => second.season_scoring - first.season_scoring);
  const games = opponentGames(target.opponent);
  return {
    target,
    ...seasonMetadata(season),
    games_considered: {
      kept: games.filter((game) => conditionCounts(target, game)).length,
      played: games.length,
    },
    proxy: 'Outcomes are box-score proxies; there are no per-game slice splits.',
    stat_columns: statColumns,
    summary: backtestSummary(players, statColumns),
    players,
  };
};

/*
 * The preview is the backtest of a Draft Target, which is stored nowhere: the
 * same composition over the same league, with the draft echoed back under its
 * derived title and no id, plus whether it fires on the current Slate date.
 * The body is validated as create would validate it; the account cap and the
 * duplicate rule do not apply.
 */
const TARGET_QUALIFIER_LIMIT = 10;

const invalidTargetBody = (body) =>
  !body ||
  typeof body.opponent !== 'string' ||
  !Array.isArray(body.qualifiers) ||
  body.qualifiers.length === 0 ||
  body.qualifiers.length > TARGET_QUALIFIER_LIMIT ||
  body.qualifiers.some(
    (qualifier) =>
      !knownSlice(qualifier.base, qualifier.slice_key) ||
      !['at_or_above', 'at_or_below'].includes(qualifier.comparator) ||
      typeof qualifier.threshold !== 'number' ||
      qualifier.threshold < 0 ||
      qualifier.threshold > 1,
  );

const previewTarget = (draft, season) => {
  const target = { ...draft, title: backendTargetTitle(draft) };
  const [entry] = resolveTargets(DEFAULT_SLATE_DATE, [target]).targets;
  return {
    ...backtestTarget(target, season),
    today: entry.game ? { game: entry.game, fit_count: entry.players.length } : null,
  };
};

const isCalendarDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

// The routes the backend serves without authentication.
// `fallback=previous_game_day` or `next_game_day` is only valid on its own
// (crf04/statsplus#217, #242).
// Every day in this contract but the completed one lists a game, so the
// current day never has to fall back and the parameter answers as if absent.
const invalidFallback = (url) => {
  const fallback = url.searchParams.get('fallback');
  return (
    fallback !== null &&
    (!['previous_game_day', 'next_game_day'].includes(fallback) || url.searchParams.has('date'))
  );
};
const refuseFallback = (route) =>
  route.fulfill({
    status: 400,
    json: {
      error: {
        code: 'invalid_input',
        message:
          'fallback must be previous_game_day or next_game_day and cannot be combined with date.',
      },
    },
  });

const PUBLIC_ROUTES = new Set(['/api/games/slate', '/api/games/slate/edges', '/api/games/ladder']);

// One published report (crf04/statsplus#342), trimmed from the 2026-10-25 injury brief:
// two games, two spots, two set-aside players and two real cards (game logs, on/off).
export const REPORT_ID = 'k3x9q2mtzr';
export const reportPayload = () => structuredClone(reportFixture);

// The ladder's three Filter Sets, as the backend owns them, each answered from
// the same game-log composition `/api/games/game_logs` serves for them.
const LADDER_FILTER_SETS = [
  ['start', 'player_name=Jalen+Johnson'],
  ['narrow', 'player_name=Jalen+Johnson&players_off[]=Trae+Young'],
  [
    'stack',
    'player_name=Jalen+Johnson&players_off[]=Trae+Young&teams_against[]=OPP_PTS&rank_filter[]=10&minutes_filter=25,48',
  ],
];

const ladderPayload = () => ({
  rungs: LADDER_FILTER_SETS.map(([id, query]) => {
    const url = new URL(`http://fixture.invalid/api/games/game_logs?${query}`);
    const name = url.searchParams.get('player_name');
    const kept = applyOpponentTricode(
      applySelfFilters(applySeason(seasonsByPlayer[name] || gameLogs, url), url),
      url,
    );
    return {
      id,
      points: kept.length > 0 ? averages.PTS : null,
      games: kept.length,
      series: kept.map((log) => log.PTS),
    };
  }),
});

// The backend's refusal of every authenticated route for a waitlisted account
// (crf04/statsplus#157, Boundary contract).
export const waitlistedResponse = {
  status: 403,
  json: {
    error: {
      code: 'waitlisted',
      message: "The beta is full right now. You're on the waitlist and we'll let you in soon.",
    },
  },
};

/*
 * The backend's refusal when a user is over a rate limit (crf04/statsplus#157):
 * 429, Retry-After, and the standard error shape. Pass it as the override of
 * one route to make only that route rate limited:
 *   installApiContract(page, { '/api/games/game_logs': RATE_LIMITED });
 * A Target's own backtest route is keyed '/api/user/targets/:id/backtest'.
 */
export const RATE_LIMITED = {
  status: 429,
  headers: { 'Retry-After': '3' },
  body: {
    error: { code: 'rate_limited', message: 'Too many requests. Try again in 3 seconds.' },
  },
};

const fulfillOverride = (route, response) =>
  route.fulfill({
    status: response.status || 200,
    headers: response.headers,
    json: response.body ?? response,
  });

// Shooting Type rows as /api/players/profile returns them (per game, season).
const SHOOTING_TYPE_PROFILE = [
  { SHOT_TYPE: 'C&S', FGA_FREQUENCY: 0.203, FGM: 1.4, FGA: 3.5, FG_PCT: 0.402, FG2M: 0.2, FG2A: 0.4, FG2_PCT: 0.5, FG2A_FREQUENCY: 0.024, FG3M: 1.2, FG3A: 3.0, FG3_PCT: 0.388, FG3A_FREQUENCY: 0.178 },
  { SHOT_TYPE: 'Pullup', FGA_FREQUENCY: 0.239, FGM: 1.6, FGA: 4.1, FG_PCT: 0.398, FG2M: 1.2, FG2A: 2.7, FG2_PCT: 0.449, FG2A_FREQUENCY: 0.16, FG3M: 0.4, FG3A: 1.4, FG3_PCT: 0.296, FG3A_FREQUENCY: 0.08 },
  { SHOT_TYPE: '<10 Ft', FGA_FREQUENCY: 0.529, FGM: 5.2, FGA: 9.0, FG_PCT: 0.575, FG2M: 5.2, FG2A: 9.0, FG2_PCT: 0.575, FG2A_FREQUENCY: 0.529, FG3M: 0, FG3A: 0, FG3_PCT: 0, FG3A_FREQUENCY: 0 },
]; // prettier-ignore

// The parts of an Unscheduled Matchup the Zone Shooting court reads: the
// player's Shot-zone Diet and the opponent's season made/attempted rows.
const SHOT_ZONE_DIET = [
  ['Restricted Area', 0.313, 0.276, 18, -0.3],
  ['In The Paint (Non-RA)', 0.294, 0.201, 14, -1.4],
  ['Mid-Range', 0.116, 0.098, 9, -6.7],
  ['Corner 3', 0.02, 0.106, 2, -18.6],
  ['Above the Break 3', 0.257, 0.32, 19, 2.3],
];
const unscheduledShotZonePayload = (opponent) => ({
  players: [
    {
      diet_shares: {
        shot_zones: SHOT_ZONE_DIET.map(([key, share, league]) => ({
          key,
          season: { share, league_average_share: league, games_played: 72, volume: 100, volume_unit: 'field_goal_attempts', sigma_deviation: 0 },
        })),
      },
    },
  ],
  teams: [
    {
      tricode: opponent,
      defense_sheet: {
        shot_zones: SHOT_ZONE_DIET.flatMap(([key, , , rank, percent]) =>
          ['FGM', 'FGA'].map((stat) => ({
            key: `${key}:${stat}`,
            season: { rank, percent_vs_league_average: percent, allowed_per_48: 10, sigma_deviation: 0 },
          })),
        ),
      },
    },
  ],
}); // prettier-ignore

export const installApiContract = async (page, overrides = {}, { waitlisted = false } = {}) => {
  const operationsJobs = [...operationsPayload.jobs];
  // Saved Filter Sets are account state rather than reference data, so the
  // contract remembers what this page saved: a list that never changes cannot
  // show that saving, renaming, and deleting reach the same list.
  const savedFilterSets = [];
  let nextSavedFilterSetId = 0;
  // Targets are account state too: the contract remembers what this page saved
  // so that creating, editing, and deleting reach the same list.
  const targets = [];
  let nextTargetId = 0;
  // The backend's per-Target Backtest result cache: the single route fills it,
  // and the batch route only reads it. The key is what the Backtest depends
  // on, so an edited Target misses until it is read again.
  const cachedBacktests = new Set();
  const backtestCacheKey = (target, season) =>
    JSON.stringify([
      target.id,
      season ?? DEFAULT_SEASON,
      target.opponent,
      target.qualifiers,
      target.conditions ?? null,
    ]);
  let attributionRecorded = false;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const override =
      overrides[url.pathname] ??
      overrides[url.pathname.replace(/^(\/api\/user\/targets\/)[^/]+(\/backtest)$/, '$1:id$2')];

    // Accepted even for a waitlisted account, as the backend does.
    if (url.pathname === '/api/user/attribution' && request.method() === 'POST' && !override) {
      if (request.headers().authorization !== 'Bearer courtai-e2e-token') {
        await route.fulfill({
          status: 401,
          json: { error: { code: 'unauthorized', message: 'Missing E2E bearer token.' } },
        });
        return;
      }
      let body;
      try {
        body = request.postDataJSON();
      } catch {
        body = null;
      }
      const isObject = body !== null && typeof body === 'object' && !Array.isArray(body);
      const known = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'ref',
        'referrer',
        'landing_path',
        'landed_at',
      ];
      if (!isObject || known.some((k) => body[k] != null && typeof body[k] !== 'string')) {
        await route.fulfill({
          status: 400,
          json: { error: { code: 'invalid_attribution', message: 'Invalid attribution body.' } },
        });
        return;
      }
      // Write-once per account; the E2E user is the only account.
      const recorded = attributionRecorded;
      attributionRecorded = true;
      await route.fulfill({ status: recorded ? 200 : 201, json: { recorded: !recorded } });
      return;
    }

    // Feedback is accepted for a waitlisted account too (crf04/statsplus#258).
    if (url.pathname === '/api/user/feedback' && request.method() === 'POST' && !override) {
      if (request.headers().authorization !== 'Bearer courtai-e2e-token') {
        await route.fulfill({
          status: 401,
          json: { error: { code: 'unauthorized', message: 'Missing E2E bearer token.' } },
        });
        return;
      }
      let body;
      try {
        body = request.postDataJSON();
      } catch {
        body = null;
      }
      const message = typeof body?.message === 'string' ? body.message.trim() : '';
      const handle = typeof body?.x_handle === 'string' ? body.x_handle.replace(/^@/, '') : null;
      const valid =
        message.length >= 1 &&
        message.length <= 4000 &&
        (handle === null || /^[A-Za-z0-9_]{1,15}$/.test(handle)) &&
        (body.error_ref == null || /^[0-9a-f]{8}$/.test(body.error_ref)) &&
        (body.viewport == null || /^\d{2,5}x\d{2,5}$/.test(body.viewport));
      await route.fulfill(
        valid
          ? { status: 201, json: { sent: true } }
          : {
              status: 400,
              json: { error: { code: 'invalid_feedback', message: 'Invalid feedback body.' } },
            },
      );
      return;
    }

    // A published report is an anonymous read (crf04/statsplus#342): the stored
    // document, its card calls' results and the card HTML, or 404 for any other id.
    const reportPath = url.pathname.startsWith('/api/reports/') && url.pathname.split('/');
    if (reportPath && reportPath.length === 4 && request.method() === 'GET') {
      if (override) {
        await fulfillOverride(
          route,
          typeof override === 'function' ? await override(request) : override,
        );
      } else if (reportPath[3] === REPORT_ID) {
        await route.fulfill({ json: reportPayload() });
      } else {
        await route.fulfill({
          status: 404,
          json: { error: { code: 'resource_not_found', message: 'Report not found.' } },
        });
      }
      return;
    }

    // The author deletes their own report; any other id is not theirs (404, as the backend answers).
    if (url.pathname.startsWith('/api/user/reports/') && request.method() === 'DELETE') {
      const id = url.pathname.split('/')[4];
      if (request.headers().authorization !== 'Bearer courtai-e2e-token') {
        await route.fulfill({
          status: 401,
          json: { error: { code: 'unauthorized', message: 'Missing E2E bearer token.' } },
        });
        return;
      }
      await route.fulfill(
        id === REPORT_ID
          ? { json: { success: true, message: 'Report deleted.' } }
          : {
              status: 404,
              json: {
                error: { code: 'resource_not_found', message: "This report isn't available." },
              },
            },
      );
      return;
    }

    // The Slate, its Edges and the ladder are anonymous reads (crf04/statsplus#211):
    // answered whoever asks, a waitlisted account included, and whatever
    // Authorization header comes with them.
    if (override && PUBLIC_ROUTES.has(url.pathname)) {
      const response = typeof override === 'function' ? await override(request) : override;
      await fulfillOverride(route, response);
      return;
    }

    if (
      ['/api/games/slate/edges', '/api/games/slate'].includes(url.pathname) &&
      invalidFallback(url)
    ) {
      await refuseFallback(route);
      return;
    }

    if (url.pathname === '/api/games/slate/edges') {
      const date = url.searchParams.get('date') || todaySlateDate();
      await route.fulfill({
        json: slateEdgesPayload(
          date,
          date === HISTORICAL_SLATE_DATE ? [historicalGame] : [scheduleOnlySlateGame],
        ),
      });
      return;
    }

    if (url.pathname === '/api/games/slate') {
      const date = url.searchParams.get('date') || todaySlateDate();
      // Every date but the completed one lists a game, so the nearest game day
      // on either side is the adjacent date.
      const adjacent = (days) => {
        const moved = new Date(`${date}T12:00:00Z`);
        moved.setUTCDate(moved.getUTCDate() + days);
        return moved.toISOString().slice(0, 10);
      };
      const neighbours = { previousGameDate: adjacent(-1), nextGameDate: adjacent(1) };
      // The completed LAC @ MIL game is on its own date, so a Target aimed at
      // either side of it resolves against game-log participants there. The
      // pool freshness matches the evidence resolution reports for the same
      // date: a stored Player Pool on the scheduled date, none on the
      // completed one, where the participants are the game's own logs.
      await route.fulfill({
        json:
          date === HISTORICAL_SLATE_DATE
            ? slatePayload(date, [historicalGame], neighbours)
            : slatePayload(date, [scheduleOnlySlateGame], {
                ...neighbours,
                poolFreshnessStatus: 'fresh',
                poolRetrievedAt: '2026-01-15T11:50:00Z',
              }),
      });
      return;
    }

    if (url.pathname === '/api/games/ladder') {
      // The backend refuses any query parameter rather than ignoring it.
      if ([...url.searchParams.keys()].length > 0) {
        await route.fulfill({
          status: 400,
          json: {
            error: { code: 'invalid_input', message: 'The ladder takes no query parameters.' },
          },
        });
        return;
      }
      await route.fulfill({ json: ladderPayload() });
      return;
    }

    if (waitlisted) {
      await route.fulfill(waitlistedResponse);
      return;
    }

    if (url.pathname === '/api/admin/collection/diagnostics' && request.method() === 'GET') {
      await route.fulfill({ json: { ...operationsPayload, jobs: operationsJobs } });
      return;
    }

    if (url.pathname === '/api/admin/collection/reconciliation' && request.method() === 'GET') {
      await route.fulfill({ json: { items: operationsPayload.reconciliation } });
      return;
    }

    if (url.pathname.startsWith('/api/admin/collection/') && request.method() === 'POST') {
      const matchedContract = mutationContract
        .map((contract) => ({ contract, match: url.pathname.match(contract.match) }))
        .find(({ match }) => match);
      if (!matchedContract) {
        await route.fulfill({ status: 501, json: { error: 'Undocumented operator mutation.' } });
        return;
      }
      if (request.headers().authorization !== 'Bearer courtai-e2e-token') {
        await route.fulfill({ status: 401, json: { error: 'Missing E2E bearer token.' } });
        return;
      }
      let body;
      try {
        body = request.postDataJSON();
      } catch {
        body = null;
      }
      if (!body || !matchedContract.contract.valid(body)) {
        await route.fulfill({ status: 400, json: { error: 'Invalid operator mutation body.' } });
        return;
      }

      if (override) {
        const response = typeof override === 'function' ? await override(request) : override;
        await fulfillOverride(route, response);
        return;
      }

      const job = {
        job_id: `job-e2e-${operationsJobs.length + 1}`,
        action: matchedContract.contract.action,
        resource: decodeURIComponent(matchedContract.match[1] || 'e2e-resource'),
        status: 'queued',
        created_at: '2026-04-13T00:10:00Z',
        completed_at: null,
        error_code: null,
      };
      operationsJobs.unshift(job);
      await route.fulfill({
        status: 202,
        json: matchedContract.contract.response(job.job_id, matchedContract.match, body),
      });
      return;
    }

    if (override) {
      const response = typeof override === 'function' ? await override(request) : override;
      await fulfillOverride(route, response);
      return;
    }

    const savedFilterSetPath =
      url.pathname === '/api/user/saved-filter-sets'
        ? [url.pathname, undefined]
        : url.pathname.match(/^\/api\/user\/saved-filter-sets\/(.+)$/);
    if (savedFilterSetPath) {
      const [, savedFilterSetId] = savedFilterSetPath;
      const method = request.method();
      const body = ['POST', 'PATCH'].includes(method) ? request.postDataJSON() : null;
      const duplicateName = (name, ignoredId) =>
        savedFilterSets.some(
          (item) => item.id !== ignoredId && item.name.toLowerCase() === String(name).toLowerCase(),
        );
      const conflict = (message) =>
        route.fulfill({ status: 409, json: { error: { code: 'conflict', message } } });
      const invalidName = () =>
        route.fulfill({
          status: 400,
          json: { error: { code: 'invalid_request', message: 'Invalid saved filter set.' } },
        });
      const index = savedFilterSets.findIndex((item) => String(item.id) === savedFilterSetId);

      if (method === 'GET') {
        await route.fulfill({ json: { success: true, saved_filter_sets: savedFilterSets } });
        return;
      }

      if (method === 'POST') {
        if (!body?.name?.trim() || typeof body.query_string !== 'string') {
          await invalidName();
          return;
        }
        if (duplicateName(body.name)) {
          await conflict('You already have a saved Filter Set with that name.');
          return;
        }
        nextSavedFilterSetId += 1;
        // Newest-first is the list's contract, so the store keeps that order.
        savedFilterSets.unshift({
          id: nextSavedFilterSetId,
          name: body.name.trim(),
          query_string: body.query_string,
          created_at: '2026-04-13T00:10:00Z',
          updated_at: '2026-04-13T00:10:00Z',
        });
        // A single item travels in its own envelope, as the backend sends it.
        await route.fulfill({
          status: 201,
          json: { success: true, saved_filter_set: savedFilterSets[0] },
        });
        return;
      }

      if (index === -1) {
        await route.fulfill({
          status: 404,
          json: { error: { code: 'resource_not_found', message: 'Saved filter set not found.' } },
        });
        return;
      }

      if (method === 'PATCH') {
        if (!body?.name?.trim()) {
          await invalidName();
          return;
        }
        if (duplicateName(body.name, savedFilterSets[index].id)) {
          await conflict('You already have a saved Filter Set with that name.');
          return;
        }
        savedFilterSets[index] = {
          ...savedFilterSets[index],
          name: body.name.trim(),
          // The query string is immutable; only the name and its timestamp move.
          updated_at: '2026-04-13T00:20:00Z',
        };
        await route.fulfill({ json: { success: true, saved_filter_set: savedFilterSets[index] } });
        return;
      }

      if (method === 'DELETE') {
        savedFilterSets.splice(index, 1);
        await route.fulfill({ json: { success: true } });
        return;
      }
    }

    const rosterMatch = url.pathname.match(/^\/api\/teams\/([A-Z]{3})\/season-minutes$/);
    if (rosterMatch) {
      if (request.headers().authorization !== 'Bearer courtai-e2e-token') {
        await route.fulfill({
          status: 401,
          json: { error: { code: 'authentication_required', message: 'Authentication required.' } },
        });
        return;
      }
      // The roster follows the Backtest's season rule.
      const season = url.searchParams.get('season') ?? undefined;
      const refusal = seasonRefusal(season);
      if (refusal) {
        await route.fulfill(refusal);
        return;
      }
      await route.fulfill({
        json: { ...seasonMetadata(season), players: CONDITION_ROSTERS[rosterMatch[1]] || [] },
      });
      return;
    }

    if (url.pathname === '/api/diet/baselines') {
      if (request.headers().authorization !== 'Bearer courtai-e2e-token') {
        await route.fulfill({
          status: 401,
          json: { error: { code: 'authentication_required', message: 'Authentication required.' } },
        });
        return;
      }
      await route.fulfill({
        json: {
          season: '2025-26',
          captured_at: '2026-01-15T00:00:00Z',
          shares: {
            shot_zones: {
              'Restricted Area': 0.3,
              'In The Paint (Non-RA)': 0.16,
              'Mid-Range': 0.12,
              'Corner 3': 0.1,
              'Above the Break 3': 0.32,
            },
            play_types: {
              Isolation: 0.08,
              Transition: 0.0925,
              PRBallHandler: 0.2,
              PRRollMan: 0.07,
              Spotup: 0.2,
              Cut: 0.05,
              Handoff: 0.05,
              OffScreen: 0.05,
              Postup: 0.05,
              OffRebound: null,
            },
            shot_types: { 'Catch and Shoot': 0.35, Pullups: 0.25, 'Less Than 10 ft': 0.4 },
            assist_locations: {
              AtRimAssists: 0.14,
              Arc3Assists: 0.35,
              Corner3Assists: 0.2,
              ShortMidRangeAssists: 0.2,
              LongMidRangeAssists: 0.11,
            },
          },
        },
      });
      return;
    }
    const targetsMatch = url.pathname.match(/^\/api\/user\/targets(?:\/(.+))?$/);
    if (targetsMatch) {
      const [, targetId] = targetsMatch;
      const method = request.method();
      const body = ['POST', 'PATCH'].includes(method) ? request.postDataJSON() : null;
      if (body && body.stat_preferences != null) {
        const prefs = body.stat_preferences;
        if (
          !Array.isArray(prefs.columns) ||
          !prefs.columns.length ||
          new Set(prefs.columns).size !== prefs.columns.length ||
          prefs.columns.some((key) => !statCatalogue.includes(key)) ||
          !prefs.columns.includes(prefs.graded_by)
        ) {
          await route.fulfill({
            status: 400,
            json: { error: { code: 'invalid_input', message: 'Invalid stat preferences.' } },
          });
          return;
        }
      }
      const index = targets.findIndex((item) => String(item.id) === targetId);
      const toStored = (qualifier) => ({
        base: qualifier.base,
        slice_key: qualifier.slice_key,
        comparator: qualifier.comparator,
        threshold: qualifier.threshold,
      });
      const conflict = (message) =>
        route.fulfill({ status: 409, json: { error: { code: 'operation_conflict', message } } });

      // Day-scoped resolution, not a Target with the id "resolve".
      if (targetId === 'resolve') {
        if (invalidFallback(url)) {
          await refuseFallback(route);
          return;
        }
        const date = url.searchParams.get('date');
        if (date !== null && !isCalendarDate(date)) {
          await route.fulfill({
            status: 400,
            json: { error: { code: 'invalid_input', message: 'Enter a valid date.' } },
          });
          return;
        }
        await route.fulfill({
          json: {
            success: true,
            // The fallback form names no date: it answers for the current
            // Slate Date, the day the Slate itself answers for.
            ...resolveTargets(
              date || (url.searchParams.has('fallback') ? todaySlateDate() : DEFAULT_SLATE_DATE),
              targets,
            ),
          },
        });
        return;
      }

      // The backtest of a Draft Target, not a Target with the id "preview".
      // A league-wide scan is not an open resource, so it refuses a missing
      // bearer before it reads the body.
      if (url.pathname === '/api/user/targets/preview' && method === 'POST') {
        if (request.headers().authorization !== 'Bearer courtai-e2e-token') {
          await route.fulfill({
            status: 401,
            json: {
              error: { code: 'authentication_required', message: 'Sign in to preview a Target.' },
            },
          });
          return;
        }
        // Only an omitted season is the default; a present one must be a
        // season string, so an explicit null is refused.
        const season = body?.season;
        if (body && 'season' in body && typeof season !== 'string') {
          await route.fulfill(invalidSeasonResponse);
          return;
        }
        const refusal = seasonRefusal(season);
        if (refusal) {
          await route.fulfill(refusal);
          return;
        }
        if (invalidTargetBody(body) || !validFixtureConditions(body.conditions, body.opponent)) {
          await route.fulfill({
            status: 400,
            json: {
              error: {
                code: 'invalid_input',
                message: `Each of at most ${TARGET_QUALIFIER_LIMIT} Qualifiers needs a known base and slice, a comparator, and a threshold between 0 and 1.`,
              },
            },
          });
          return;
        }
        await route.fulfill({
          json: {
            success: true,
            ...previewTarget(
              {
                opponent: body.opponent,
                qualifiers: body.qualifiers.map(toStored),
                note: body.note || '',
                conditions: canonicalFixtureConditions(body.conditions),
                stat_preferences: body.stat_preferences ?? null,
              },
              season,
            ),
          },
        });
        return;
      }

      // Every cached Target backtest in one read, in list order, from the same
      // composition the single route serves; a Target the single route has not
      // read yet is uncached. Not a Target with the id "backtests". Like every
      // account route it refuses a missing bearer.
      if (url.pathname === '/api/user/targets/backtests' && method === 'GET') {
        if (request.headers().authorization !== 'Bearer courtai-e2e-token') {
          await route.fulfill({
            status: 401,
            json: {
              error: { code: 'authentication_required', message: 'Authentication required.' },
            },
          });
          return;
        }
        const season = url.searchParams.get('season') ?? undefined;
        const refusal = seasonRefusal(season);
        if (refusal) {
          await route.fulfill(refusal);
          return;
        }
        await route.fulfill({
          json: {
            success: true,
            ...seasonMetadata(season),
            backtests: targets.map((target) =>
              cachedBacktests.has(backtestCacheKey(target, season))
                ? { target_id: target.id, status: 'ok', backtest: backtestTarget(target, season) }
                : { target_id: target.id, status: 'uncached' },
            ),
          },
        });
        return;
      }

      // The season-to-date backtest of one Target, not a Target whose id ends
      // in "/backtest".
      const backtestId = targetId?.match(/^(.+)\/backtest$/)?.[1];
      if (backtestId !== undefined && method === 'GET') {
        const target = targets.find((item) => String(item.id) === backtestId);
        if (!target) {
          await route.fulfill({
            status: 404,
            json: { error: { code: 'resource_not_found', message: 'Target not found.' } },
          });
          return;
        }
        const season = url.searchParams.get('season') ?? undefined;
        const refusal = seasonRefusal(season);
        if (refusal) {
          await route.fulfill(refusal);
          return;
        }
        cachedBacktests.add(backtestCacheKey(target, season));
        await route.fulfill({ json: { success: true, ...backtestTarget(target, season) } });
        return;
      }

      if (url.pathname === '/api/user/targets' && method === 'GET') {
        await route.fulfill({ json: { success: true, targets } });
        return;
      }

      if (
        (method === 'POST' || method === 'PATCH') &&
        !validFixtureConditions(body.conditions, body.opponent || targets[index]?.opponent)
      ) {
        await route.fulfill({
          status: 400,
          json: { error: { code: 'invalid_input', message: 'Invalid Conditions.' } },
        });
        return;
      }

      if (method === 'POST') {
        const qualifiers = body.qualifiers.map(toStored);
        if (
          targets.some(
            (item) =>
              item.opponent === body.opponent &&
              canonicalQualifiers(item.qualifiers) === canonicalQualifiers(qualifiers),
          )
        ) {
          await conflict(`You already have that Target for ${body.opponent}.`);
          return;
        }
        if (targets.length >= TARGET_LIMIT) {
          await conflict(`You have reached the limit of ${TARGET_LIMIT} Targets.`);
          return;
        }
        nextTargetId += 1;
        const created = {
          id: nextTargetId,
          opponent: body.opponent,
          qualifiers,
          note: body.note || '',
          conditions: canonicalFixtureConditions(body.conditions),
          stat_preferences: body.stat_preferences ?? null,
          created_at: '2026-04-13T00:10:00Z',
        };
        // Newest-first is the list's contract, as it is for Saved Filter Sets.
        targets.unshift({ ...created, title: backendTargetTitle(created) });
        await route.fulfill({ status: 201, json: { success: true, target: targets[0] } });
        return;
      }

      // A Target another session already deleted is gone for this one too, and
      // splicing at -1 would quietly remove the oldest Target instead.
      if (index === -1) {
        await route.fulfill({
          status: 404,
          json: { error: { code: 'resource_not_found', message: 'Target not found.' } },
        });
        return;
      }

      if (method === 'PATCH') {
        // Only the Qualifiers and the note move; the title follows the
        // Qualifiers because it is derived from them.
        const updated = {
          ...targets[index],
          ...(body.qualifiers !== undefined ? { qualifiers: body.qualifiers.map(toStored) } : {}),
          ...(body.note !== undefined ? { note: body.note || '' } : {}),
          ...(body.conditions !== undefined
            ? { conditions: canonicalFixtureConditions(body.conditions) }
            : {}),
          ...(body.stat_preferences !== undefined
            ? { stat_preferences: body.stat_preferences }
            : {}),
        };
        targets[index] = { ...updated, title: backendTargetTitle(updated) };
        await route.fulfill({ json: { success: true, target: targets[index] } });
        return;
      }

      if (method === 'DELETE') {
        targets.splice(index, 1);
        await route.fulfill({ json: { success: true, message: 'Target deleted' } });
        return;
      }
    }

    if (url.pathname === '/api/players/next-opponent') {
      await route.fulfill({ json: { next_game: null, opponent_ranks: [] } });
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
      // "Ball" names two players, so the parser asks instead of choosing; the
      // main player is left null and the Filter Set holds back (statsplus#264).
      // "Williams" is long enough to overflow a phone: 14 Williamses, plus a
      // with and a without reference.
      if (/\bwilliams\b/i.test(request.postDataJSON()?.query ?? '')) {
        const pair = (text, role, names) => ({
          role,
          text,
          candidates: names.map((name, i) => ({ name, team: i ? 'CLE' : 'CHA' })),
        });
        await route.fulfill({
          json: {
            player_name: null,
            confidence: 0.9,
            player_choices: [
              pair(
                'Williams',
                'main',
                Array.from({ length: 14 }, (_, i) => `Player ${i + 1} Williams`),
              ),
              pair('Ball', 'with', ['LaMelo Ball', 'Lonzo Ball']),
              pair('Davis', 'without', ['Anthony Davis', 'Terence Davis']),
            ],
          },
        });
        return;
      }
      if (/\bball\b/i.test(request.postDataJSON()?.query ?? '')) {
        await route.fulfill({
          json: {
            player_name: null,
            game_count: 10,
            confidence: 0.9,
            player_choices: [
              {
                role: 'main',
                text: 'Ball',
                candidates: [
                  { name: 'LaMelo Ball', team: 'CHA' },
                  { name: 'Lonzo Ball', team: 'CLE' },
                ],
              },
            ],
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          player_name: 'LeBron James',
          game_count: 10,
          confidence: 0.96,
        },
      });
      return;
    }

    if (url.pathname === '/api/games/seasons') {
      await route.fulfill({ json: SEASONS });
      return;
    }

    if (url.pathname === '/api/games/game_logs') {
      const playerName = url.searchParams.get('player_name');
      const season = applySeason(seasonsByPlayer[playerName] || gameLogs, url);
      await route.fulfill({
        json: {
          game_logs: applyDateRange(applyOpponentTricode(applySelfFilters(season, url), url), url),
          averages: [averages],
          season_averages: [{ ...averages, PTS: 27, AST: 8 }],
          // Like the real endpoint, the season total ignores every filter.
          season_game_count: season.length,
          next_game: 'Atlanta Hawks',
          player_id: playerIdsByName[playerName] ?? null,
          posted_line: postedLinesByName[playerName] ?? null,
        },
      });
      return;
    }

    if (url.pathname === '/api/games/matchup') {
      const gameId = url.searchParams.get('game_id');
      await route.fulfill({
        json: gameId === HISTORICAL_GAME_ID ? historicalMatchupPayload : matchupPayload,
      });
      return;
    }

    if (url.pathname === '/api/games/matchup/selection') {
      const gameId = url.searchParams.get('game_id');
      const playerId = url.searchParams.get('player_id');
      const payloadsByGame = {
        [matchupPayload.game.game_id]: {
          2544: selectionPayload,
          1630559: austinSelectionPayload,
        },
        // A canonical game-log participant is selectable with no Player Pool.
        [HISTORICAL_GAME_ID]: { 202695: historicalSelectionPayload },
      };
      const payloads = payloadsByGame[gameId];
      if (!payloads || !payloads[playerId]) {
        await route.fulfill({ status: 404, json: { error: { code: 'resource_not_found' } } });
        return;
      }
      await route.fulfill({ json: payloads[playerId] });
      return;
    }

    if (url.pathname === '/api/players/profile') {
      await route.fulfill({
        json:
          url.searchParams.get('category') === 'Shooting Type'
            ? SHOOTING_TYPE_PROFILE
            : { Transition: 1.2, Isolation: 0.9 },
      });
      return;
    }

    if (url.pathname === '/api/matchups/unscheduled') {
      const opponent = url.searchParams.get('opponent');
      if (!/^[A-Z]{3}$/.test(opponent || '') || !url.searchParams.get('player_name')) {
        await route.fulfill({ status: 400, json: { error: { code: 'invalid_input' } } });
        return;
      }
      await route.fulfill({ json: unscheduledShotZonePayload(opponent) });
      return;
    }

    if (url.pathname === '/api/teams/stats') {
      const category = url.searchParams.get('category');
      if (category === 'Shooting Type') {
        await route.fulfill({
          json: ['Catch and Shoot', 'Pullups', 'Less Than 10 ft'].map((ShootingType) => ({
            ShootingType,
            FGA: 10,
            FGA_RANK: 30,
            FGA_vs_avg_pct: 60,
            FG2A: 2,
            FG2A_RANK: 1,
            FG3A: 8,
            FG3A_RANK: 30,
            PTS: 20,
            PTS_RANK: 10,
            PTS_vs_avg_pct: -10,
          })),
        });
        return;
      }
      if (category === 'Zone Shooting') {
        await route.fulfill({
          json: Object.fromEntries(
            [
              'Restricted Area',
              'In The Paint (Non-RA)',
              'Mid-Range',
              'Corner 3',
              'Above the Break 3',
            ].flatMap((zone) => [
              [`${zone}_OPP_FGA`, 20],
              [`${zone}_OPP_FGA_RANK`, 8],
              [`${zone}_OPP_FGA_vs_avg_pct`, -12],
            ]),
          ),
        });
        return;
      }
      if (category === 'Assists') {
        await route.fulfill({
          json: Object.fromEntries(
            [
              'Arc3Assists',
              'Corner3Assists',
              'AtRimAssists',
              'ShortMidRangeAssists',
              'LongMidRangeAssists',
            ].flatMap((key) => [
              [key, 1.2],
              [`${key}_RANK`, 25],
            ]),
          ),
        });
        return;
      }
      if (url.searchParams.get('category') === 'Playtype Points') {
        await route.fulfill({
          json: Object.fromEntries(
            [
              'Transition',
              'Isolation',
              'PRBallHandler',
              'PRRollMan',
              'Spotup',
              'Cut',
              'Handoff',
              'OffScreen',
              'Postup',
              'OffRebound',
              'Misc',
            ].flatMap((key) => [
              [key, 28],
              [`${key}_RANK`, 12],
              [`${key}_vs_avg_pct`, -5.1],
            ]),
          ),
        });
        return;
      }
      await route.fulfill({ json: traditionalTeamStats });
      return;
    }

    await route.fulfill({ status: 501, json: { error: `Unhandled E2E route: ${url.pathname}` } });
  });
};
