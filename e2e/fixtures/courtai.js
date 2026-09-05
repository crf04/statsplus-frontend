import { expect, test as base } from '@playwright/test';

export const E2E_AUTH_STORAGE_KEY = 'courtai:e2e-authenticated';
export const E2E_ADMIN_STORAGE_KEY = 'courtai:e2e-admin';

export const gameLogs = [
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
        play_types: [
          // Current-matchup Transition population: mean .09, pstdev .075.
          // Above the sigma and volume floor: chip must render.
          dietShare('Transition', 0.19, 0.09, 0.075),
          // Current-matchup Postup population: mean .05, pstdev .1.
          // Below league average: chip stays hidden by sigma.
          dietShare('Postup', 0.02, 0.05, 0.1),
        ],
        // Current-matchup shot_zones Restricted Area population: mean .20, pstdev .06,
        // shared with Austin's and Tatum's facts below.
        shot_zones: [dietShare('Restricted Area', 0.27, 0.2, 0.06, 5.1, 'field_goal_attempts')],
        // Current-matchup shot_types Catch and Shoot population: mean .24, pstdev .10,
        // shared with Tatum's fact below.
        shot_types: [dietShare('Catch and Shoot', 0.36, 0.24, 0.1, 4.2, 'field_goal_attempts')],
        // Current-matchup assist_locations AtRimAssists population: mean .14, pstdev .12,
        // shared with Austin's and Tatum's facts below.
        assist_locations: [dietShare('AtRimAssists', 0.31, 0.14, 0.12, 1.1, 'assists')],
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
        play_types: [dietShare('Transition', 0.18, 0.09, 0.075)],
        // Restricted Area is not an FG3A-compatible slice, and no shot-type
        // Diet fact exists, so FG3A has no contributing player evidence.
        // This fact would have passed the OLD fixed share gate (>= 25% FGA),
        // but sigma_deviation stays under the 1-sigma display floor against
        // the same (mean .20, pstdev .06) population LeBron and Tatum use, so
        // it is hidden by sigma, not by accident. If the display gate ever
        // regresses to the fixed-share rule, this chip would render again and
        // the "hidden" assertion below would fail.
        shot_zones: [dietShare('Restricted Area', 0.25, 0.2, 0.06, 5.1, 'field_goal_attempts')],
        shot_types: [],
        // Above the sigma floor (against the shared mean .14, pstdev .12
        // assist_locations population), but under the assist-locations volume
        // floor (1/g): hidden by volume, not sigma.
        assist_locations: [dietShare('AtRimAssists', 0.35, 0.14, 0.12, 0.8, 'assists')],
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
        play_types: [dietShare('Transition', 0.21, 0.09, 0.075)],
        shot_zones: [dietShare('Restricted Area', 0.29, 0.2, 0.06, 5.1, 'field_goal_attempts')],
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
};

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
          // Historical Postup population: mean .05, pstdev .15. Above league
          // average but under the 1-sigma display floor: chip stays hidden.
          dietShare('Postup', 0.14, 0.05, 0.15),
        ],
        // Historical shot_zones Restricted Area population: mean .21, pstdev
        // .06, shared with Giannis's fact below.
        shot_zones: [dietShare('Restricted Area', 0.28, 0.21, 0.06, 5.4, 'field_goal_attempts')],
        shot_types: [dietShare('Catch and Shoot', 0.34, 0.24, 0.09, 4.4, 'field_goal_attempts')],
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

// Two players whose seasons cannot be confused for one another: ranges taken
// from the wrong player's season are only detectable if the seasons differ.
export const curryGameLogs = gameLogs.map((log, index) => ({
  ...log,
  MATCHUP: log.MATCHUP.replace('LAL', 'GSW'),
  PTS: index === 0 ? 42 : 18,
}));

const seasonsByPlayer = {
  'Stephen Curry': curryGameLogs,
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

export const installApiContract = async (page, overrides = {}) => {
  const operationsJobs = [...operationsPayload.jobs];
  // Saved Filter Sets are account state rather than reference data, so the
  // contract remembers what this page saved: a list that never changes cannot
  // show that saving, renaming, and deleting reach the same list.
  const savedFilterSets = [];
  let nextSavedFilterSetId = 0;
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
          game_logs: applyOpponentTricode(
            applySelfFilters(seasonsByPlayer[url.searchParams.get('player_name')] || gameLogs, url),
            url,
          ),
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
      await route.fulfill({ json: { Transition: 1.2, Isolation: 0.9 } });
      return;
    }

    if (url.pathname === '/api/teams/stats') {
      await route.fulfill({ json: traditionalTeamStats });
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
