import { expect, test as base } from '@playwright/test';

export const E2E_AUTH_STORAGE_KEY = 'courtai:e2e-authenticated';
export const E2E_ADMIN_STORAGE_KEY = 'courtai:e2e-admin';

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
    shot_types: [
      defenseRow(
        'Catch and Shoot:FG3A',
        'Catch and Shoot FG3A',
        ['FGA', 'FG3A'],
        defenseValue(16 + offset, 9, 1.1, 23),
        defenseValue(15 + offset, 8, 1.2, 22),
      ),
    ],
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
    ['play_types', 'shot_zones', 'shot_types', 'assist_locations', 'traditional'].map((base) => [
      base,
      {
        season: { status: 'available', unavailable_reason: null },
        last_15:
          base === 'play_types'
            ? { status: 'unavailable', unavailable_reason: 'provider_unsupported' }
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
    shot_types: [leagueRow('Catch and Shoot:FG3A', 15.5, 1.2, 15.3, 1.1)],
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

const dietShare = (key, seasonShare, volumePerGame = 5.1, volumeUnit = 'possessions') => ({
  key,
  season: {
    share: seasonShare,
    volume: volumePerGame * 20,
    games_played: 20,
    volume_unit: volumeUnit,
  },
});

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
      },
      season_scoring: 25.4,
      last_10_minutes: [35, 36, 38, 34, 37, 36, 35, 39, 36, 37],
      diet_shares: {
        play_types: [dietShare('Transition', 0.19), dietShare('Postup', 0.02)],
        shot_zones: [dietShare('Restricted Area', 0.27, 5.1, 'field_goal_attempts')],
        shot_types: [dietShare('Catch and Shoot', 0.36, 4.2, 'field_goal_attempts')],
        assist_locations: [dietShare('AtRimAssists', 0.31, 1.1, 'assists')],
      },
      injury_badge_ref: null,
      scores: scores(COMPLETE_MARKETS, 0.12, -0.02),
    },
    {
      canonical_id: 1630559,
      name: 'Austin Reaves',
      team_id: slateGame.away_team.team_id,
      tricode: 'LAL',
      posted_markets: ['PTS', 'FG3A', 'STL'],
      provenance: { prizepicks: ['PTS', 'FG3A'], underdog: ['STL'] },
      season_scoring: 20.1,
      last_10_minutes: [32, 35, 34, 33, 31, 35, 36, 34, 35, 33],
      diet_shares: {
        // Above the display gate but intentionally posted for PTS, not FGA,
        // so market-tab chip scoping remains observable at the browser seam.
        play_types: [dietShare('Transition', 0.18)],
        // Restricted Area is not an FG3A-compatible slice, and no shot-type
        // Diet fact exists, so FG3A has no contributing player evidence.
        shot_zones: [dietShare('Restricted Area', 0.24, 5.1, 'field_goal_attempts')],
        shot_types: [],
        assist_locations: [dietShare('AtRimAssists', 0.35, 0.8, 'assists')],
      },
      injury_badge_ref: 'injury-austin',
      scores: scores(['PTS', 'FG3A', 'STL'], 0.24, 0.08, {
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
      season_scoring: 27.2,
      last_10_minutes: [36, 37, 35, 38, 34, 36, 39, 37, 36, 38],
      diet_shares: {
        play_types: [dietShare('Transition', 0.21)],
        shot_zones: [dietShare('Restricted Area', 0.29, 5.1, 'field_goal_attempts')],
        shot_types: [dietShare('Catch and Shoot', 0.39, 4.8, 'field_goal_attempts')],
        assist_locations: [dietShare('AtRimAssists', 0.33, 1.2, 'assists')],
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
};

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
      freshness_rule: 'cutoff_current',
    },
    {
      stream_key: 'synergy:l15',
      provider: 'nba',
      owner: 'residential_collector',
      enabled: false,
      freshness_rule: 'unavailable',
    },
    {
      stream_key: 'play_types',
      provider: 'nba',
      owner: 'residential_collector',
      enabled: false,
      freshness_rule: 'cutoff_current',
    },
  ],
  collectors: [
    {
      identity_id: 'collector-e2e-1',
      environment: 'production',
      revoked: false,
      last_seen_at: '2026-04-13T00:05:00Z',
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
      poll_count: 4,
      envelope_count: 7,
      byte_count: 4096,
    },
  ],
  jobs: [
    {
      job_id: 'job-e2e-1',
      action: 'composition.retry',
      resource: 'composition-e2e-1',
      status: 'failed',
      created_at: '2026-04-13T00:00:00Z',
      completed_at: '2026-04-13T00:02:00Z',
      error_code: 'provider_unavailable',
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

export const installApiContract = async (page, overrides = {}) => {
  const operationsJobs = [...operationsPayload.jobs];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const override = overrides[url.pathname];

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
        await route.fulfill({ status: response.status || 200, json: response.body ?? response });
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
        2544: selectionPayload,
        1630559: austinSelectionPayload,
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
  adminPage: async ({ page }, run) => {
    await page.addInitScript(
      ({ authKey, adminKey }) => {
        window.localStorage.setItem(authKey, 'true');
        window.localStorage.setItem(adminKey, 'true');
      },
      { authKey: E2E_AUTH_STORAGE_KEY, adminKey: E2E_ADMIN_STORAGE_KEY },
    );
    await installApiContract(page);
    await run(page);
  },
});

export { expect };
