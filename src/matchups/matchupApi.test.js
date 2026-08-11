import { apiClient } from '../config';
import { decodeMatchup, decodeMatchupSelection, fetchMatchupSelection } from './matchupApi';

jest.mock('../config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: jest.fn(() => '/api/games/matchup/selection'),
}));

const payload = {
  game: {
    game_id: '0022500584',
    away_team: { team_id: 1, tricode: 'LAL', name: 'Los Angeles Lakers' },
    home_team: { team_id: 2, tricode: 'BOS', name: 'Boston Celtics' },
    scheduled_at: '2026-01-16T00:30:00Z',
    status: { state: 'scheduled', label: 'Scheduled' },
    preseason: false,
  },
  league: {
    surface_availability: Object.fromEntries(
      ['play_types', 'shot_zones', 'shot_types', 'assist_locations', 'traditional'].map((base) => [
        base,
        {
          season: { status: 'available', unavailable_reason: null },
          last_15: { status: 'available', unavailable_reason: null },
        },
      ]),
    ),
    defense_sheet: {
      play_types: [
        {
          key: 'transition',
          season: { average_allowed_per_48: 16.4, sigma: 1.4 },
          last_15: { average_allowed_per_48: 16.2, sigma: 1.2 },
        },
      ],
      shot_zones: [],
      shot_types: [],
      assist_locations: [],
      traditional: [],
    },
    defensive_columns: Object.fromEntries(
      ['OPP_TOV', 'OPP_STL', 'OPP_BLK'].map((key) => [
        key,
        {
          season: { average_per_48: 10, sigma: 1 },
          last_15: { average_per_48: 11, sigma: 1.1 },
        },
      ]),
    ),
  },
  teams: [
    {
      team_id: 1,
      tricode: 'LAL',
      name: 'Los Angeles Lakers',
      defense_sheet: {
        play_types: [
          {
            key: 'transition',
            label: 'Transition',
            markets: ['PTS', 'FGA'],
            season: {
              allowed_per_48: 18.4,
              percent_vs_league_average: 12,
              sigma_deviation: 1.4,
              rank: 27,
            },
            last_15: {
              allowed_per_48: 15.2,
              percent_vs_league_average: -8,
              sigma_deviation: -1.1,
              rank: 5,
            },
          },
        ],
        shot_zones: [],
        shot_types: [],
        assist_locations: [],
        traditional: [],
      },
      defensive_columns: {
        OPP_TOV: {
          season: { per_48: 14.2, percent_vs_league_average: 8 },
          last_15: { per_48: 12.9, percent_vs_league_average: -3 },
        },
        OPP_STL: {
          season: { per_48: 7.1, percent_vs_league_average: -5 },
          last_15: { per_48: 7.8, percent_vs_league_average: 4 },
        },
        OPP_BLK: {
          season: { per_48: 5.4, percent_vs_league_average: 11 },
          last_15: { per_48: 4.7, percent_vs_league_average: -2 },
        },
      },
    },
    {
      team_id: 2,
      tricode: 'BOS',
      name: 'Boston Celtics',
      defense_sheet: {
        play_types: [],
        shot_zones: [],
        shot_types: [],
        assist_locations: [],
        traditional: [],
      },
      defensive_columns: {
        OPP_TOV: {
          season: { per_48: 12, percent_vs_league_average: -4 },
          last_15: { per_48: 13, percent_vs_league_average: 2 },
        },
        OPP_STL: {
          season: { per_48: 8, percent_vs_league_average: 5 },
          last_15: { per_48: 8.2, percent_vs_league_average: 7 },
        },
        OPP_BLK: {
          season: { per_48: 4.8, percent_vs_league_average: -2 },
          last_15: { per_48: 5, percent_vs_league_average: 1 },
        },
      },
    },
  ],
  players: [
    {
      canonical_id: 2544,
      name: 'LeBron James',
      team_id: 1,
      tricode: 'LAL',
      posted_markets: ['PTS', 'FGA'],
      provenance: { prizepicks: ['PTS', 'FGA'], underdog: ['PTS'] },
      season_scoring: 25.4,
      last_10_minutes: [35, 36],
      diet_shares: {
        play_types: [
          {
            key: 'transition',
            season: {
              share: 0.19,
              volume: 102,
              games_played: 20,
              volume_unit: 'possessions',
            },
          },
        ],
        shot_zones: [],
        shot_types: [],
        assist_locations: [],
      },
      injury_badge_ref: null,
      scores: {
        PTS: {
          season: {
            components: { play_types: { value: 0.08, thin: false } },
            blend: { value: 0.12, thin: false },
          },
          last_15: {
            components: { play_types: { value: -0.03, thin: false } },
            blend: { value: -0.01, thin: false },
          },
        },
        FGA: {
          season: {
            components: { play_types: { value: 0.04, thin: false } },
            blend: { value: 0.04, thin: false },
          },
          last_15: {
            components: { play_types: { value: 0.02, thin: false } },
            blend: { value: 0.02, thin: false },
          },
        },
      },
    },
  ],
  injuries: {
    status: 'unavailable',
    unavailable_reason: 'permission_required',
    retrieved_at: null,
    source: 'rotowire',
    source_url: 'https://example.com/injuries',
    teams: [],
  },
  freshness: {
    schedule: { status: 'fresh', retrieved_at: '2026-01-15T10:00:00Z' },
    pool: { status: 'fresh', retrieved_at: '2026-01-15T11:50:00Z', providers: {} },
    stats: { status: 'fresh', retrieved_at: '2026-01-15T10:00:00Z' },
    injuries: { status: 'unavailable', retrieved_at: null },
  },
};

test('decodes both delivered windows and preserves relative values', () => {
  const matchup = decodeMatchup(payload);

  expect(matchup.teams[0].defenseSheet.playTypes[0]).toEqual(
    expect.objectContaining({
      markets: ['PTS', 'FGA'],
      season: expect.objectContaining({ allowedPer48: 18.4, sigmaDeviation: 1.4 }),
      last15: expect.objectContaining({ percentVsLeagueAverage: -8 }),
    }),
  );
  expect(matchup.players[0]).toEqual(
    expect.objectContaining({
      id: 2544,
      postedMarkets: ['PTS', 'FGA'],
      provenance: { prizepicks: ['PTS', 'FGA'], underdog: ['PTS'] },
      scores: expect.objectContaining({
        PTS: expect.objectContaining({
          season: expect.objectContaining({ blend: { value: 0.12, thin: false } }),
        }),
      }),
    }),
  );
  expect(matchup.game).toEqual(
    expect.objectContaining({
      gameId: '0022500584',
      away: expect.objectContaining({ tricode: 'LAL' }),
    }),
  );
  expect(matchup.teams[0].defensiveColumns.OPP_TOV.season).toEqual({
    per48: 14.2,
    percentVsLeagueAverage: 8,
  });
  expect(matchup.league.defenseSheet.playTypes[0]).toEqual({
    key: 'transition',
    season: { averageAllowedPer48: 16.4, sigma: 1.4 },
    last15: { averageAllowedPer48: 16.2, sigma: 1.2 },
  });
});

test('accepts clarified freshness with derived schedule and provider-only pool timestamps', () => {
  const candidate = {
    ...payload,
    freshness: {
      ...payload.freshness,
      schedule: { retrieved_at: '2026-01-15T10:00:00Z' },
      pool: {
        providers: {
          prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T11:50:00Z' },
          underdog: { status: 'missing', retrieved_at: null },
        },
      },
    },
  };

  expect(decodeMatchup(candidate).freshness).toEqual(
    expect.objectContaining({
      schedule: expect.objectContaining({ status: expect.stringMatching(/fresh|stale/) }),
      pool: expect.objectContaining({ status: 'partial', retrievedAt: '2026-01-15T11:50:00.000Z' }),
    }),
  );
});

test('strictly decodes injury identities and enforces the v1 team envelope', () => {
  const injuryPayload = JSON.parse(JSON.stringify(payload));
  injuryPayload.injuries = {
    ...injuryPayload.injuries,
    status: 'fresh',
    unavailable_reason: null,
    retrieved_at: '2026-01-15T11:55:00Z',
    teams: [
      {
        team_id: 1,
        tricode: 'LAL',
        submission_state: 'unknown',
        entries: [
          {
            entry_id: 'injury-1',
            source_player_id: 'source-1',
            canonical_player_id: 2544,
            source_player_name: 'LeBron James',
            team_id: 1,
            tricode: 'LAL',
            canonical_status: 'Questionable',
            raw_status: 'Questionable',
            reason: 'Left ankle soreness',
            source_url: 'https://example.com/injury-1',
          },
        ],
      },
      { team_id: 2, tricode: 'BOS', submission_state: 'unknown', entries: [] },
    ],
  };
  injuryPayload.freshness.injuries = {
    status: 'fresh',
    retrieved_at: '2026-01-15T11:55:00Z',
  };
  expect(decodeMatchup(injuryPayload).injuries.teams[0].entries[0]).toEqual(
    expect.objectContaining({ sourcePlayerId: 'source-1', playerId: 2544, teamId: 1 }),
  );

  const wrongTeam = JSON.parse(JSON.stringify(injuryPayload));
  wrongTeam.injuries.teams[0].entries[0].team_id = 2;
  expect(() => decodeMatchup(wrongTeam)).toThrow('invalid response');
  const inventedSubmission = JSON.parse(JSON.stringify(injuryPayload));
  inventedSubmission.injuries.teams[0].submission_state = 'submitted';
  expect(() => decodeMatchup(inventedSubmission)).toThrow('invalid response');
  const missingSourceId = JSON.parse(JSON.stringify(injuryPayload));
  delete missingSourceId.injuries.teams[0].entries[0].source_player_id;
  expect(() => decodeMatchup(missingSourceId)).toThrow('invalid response');
});

test('accepts unavailable injuries with an honest empty team envelope', () => {
  const unavailable = {
    ...payload,
    injuries: { ...payload.injuries, teams: [] },
  };
  expect(decodeMatchup(unavailable).injuries).toEqual(
    expect.objectContaining({
      status: 'unavailable',
      unavailableReason: 'permission_required',
      teams: [],
    }),
  );

  const staleWithoutTeams = {
    ...payload,
    injuries: {
      ...payload.injuries,
      status: 'stale',
      unavailable_reason: null,
      retrieved_at: '2026-01-15T11:00:00Z',
      teams: [],
    },
  };
  expect(() => decodeMatchup(staleWithoutTeams)).toThrow('invalid response');

  const missingReason = JSON.parse(JSON.stringify(unavailable));
  delete missingReason.injuries.unavailable_reason;
  expect(() => decodeMatchup(missingReason)).toThrow('invalid response');
  const unavailableWithoutReason = JSON.parse(JSON.stringify(unavailable));
  unavailableWithoutReason.injuries.unavailable_reason = null;
  expect(() => decodeMatchup(unavailableWithoutReason)).toThrow('invalid response');
});

test('accepts league taxonomy rows that neither matchup team happens to use', () => {
  const extraLeagueRow = {
    ...payload,
    league: {
      ...payload.league,
      defense_sheet: {
        ...payload.league.defense_sheet,
        play_types: [
          ...payload.league.defense_sheet.play_types,
          {
            key: 'handoff',
            season: { average_allowed_per_48: 7.2, sigma: 0.7 },
            last_15: { average_allowed_per_48: 7.4, sigma: 0.8 },
          },
        ],
      },
    },
  };
  expect(decodeMatchup(extraLeagueRow).league.defenseSheet.playTypes).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: 'handoff' })]),
  );
});

test('decodes Season-only Diet Shares and an unavailable team window without substitution', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.league.surface_availability = Object.fromEntries(
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
  );
  candidate.league.defense_sheet.play_types[0].last_15 = null;
  candidate.teams[0].defense_sheet.play_types[0].last_15 = null;
  candidate.players[0].season_scoring = null;
  candidate.players[0].diet_shares = {
    play_types: [
      {
        key: 'transition',
        season: {
          share: 0.19,
          volume: 95,
          games_played: 20,
          volume_unit: 'possessions',
        },
      },
    ],
    shot_zones: [],
    shot_types: [],
    assist_locations: [],
  };

  const decoded = decodeMatchup(candidate);
  expect(decoded.league.surfaceAvailability.playTypes.last15).toEqual({
    status: 'unavailable',
    unavailableReason: 'provider_unsupported',
  });
  expect(decoded.league.defenseSheet.playTypes[0].last15).toBeNull();
  expect(decoded.teams[0].defenseSheet.playTypes[0].last15).toBeNull();
  expect(decoded.players[0].seasonScoring).toBeNull();
  expect(decoded.players[0].dietShares.playTypes[0]).toEqual({
    key: 'transition',
    season: {
      share: 0.19,
      volume: 95,
      gamesPlayed: 20,
      volumeUnit: 'possessions',
      volumePerGame: 4.75,
    },
  });
});

test('decodes the backend canonical injury status and preserves unmatched entries', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.injuries = {
    status: 'stale',
    unavailable_reason: null,
    retrieved_at: '2026-01-15T11:30:00Z',
    source: 'rotowire',
    source_url: 'https://www.rotowire.com/basketball/injury-report.php',
    teams: [
      {
        team_id: 1,
        tricode: 'LAL',
        submission_state: 'unknown',
        entries: [
          {
            entry_id: 'rotowire:unmatched',
            source_player_id: null,
            source_player_name: 'Unmatched Player',
            canonical_player_id: null,
            team_id: 1,
            tricode: 'LAL',
            canonical_status: 'Questionable',
            raw_status: 'Questionable',
            reason: 'Ankle soreness',
            source_url: 'https://www.rotowire.com/basketball/injury-report.php',
          },
        ],
      },
      { team_id: 2, tricode: 'BOS', submission_state: 'unknown', entries: [] },
    ],
  };
  candidate.freshness.injuries = {
    status: 'stale',
    retrieved_at: '2026-01-15T11:30:00Z',
  };

  expect(decodeMatchup(candidate).injuries.teams[0].entries[0]).toEqual(
    expect.objectContaining({
      playerId: null,
      sourcePlayerId: null,
      status: 'Questionable',
      rawStatus: 'Questionable',
    }),
  );
});

test.each([
  [
    'a null metric whose surface is available',
    (candidate) => {
      candidate.league.defense_sheet.play_types[0].season = null;
    },
  ],
  [
    'a metric whose surface is unavailable',
    (candidate) => {
      candidate.league.surface_availability.play_types.last_15 = {
        status: 'unavailable',
        unavailable_reason: 'provider_unsupported',
      };
    },
  ],
  [
    'an available surface with an unavailable reason',
    (candidate) => {
      candidate.league.surface_availability.play_types.season.unavailable_reason = 'not_stored';
    },
  ],
  [
    'an unavailable surface without a reason',
    (candidate) => {
      candidate.league.surface_availability.play_types.last_15 = {
        status: 'unavailable',
        unavailable_reason: null,
      };
      candidate.league.defense_sheet.play_types[0].last_15 = null;
      candidate.teams[0].defense_sheet.play_types[0].last_15 = null;
    },
  ],
  [
    'an invented Diet Share Last-15 window',
    (candidate) => {
      candidate.players[0].diet_shares.play_types[0].last_15 = {
        share: 0.2,
        volume: 100,
        games_played: 15,
        volume_unit: 'possessions',
      };
    },
  ],
  [
    'a Diet Share without its volume unit',
    (candidate) => {
      delete candidate.players[0].diet_shares.play_types[0].season.volume_unit;
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('requires unavailable injuries to use the backend empty-team encoding', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.injuries.teams = [
    { team_id: 1, tricode: 'LAL', submission_state: 'unknown', entries: [] },
    { team_id: 2, tricode: 'BOS', submission_state: 'unknown', entries: [] },
  ];
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('requires injury block and injury freshness status to agree', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.freshness.injuries = { status: 'missing', retrieved_at: null };
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('requires Blend for offensive scores and accepts omitted or null Blend for defensive scores', () => {
  const defensive = JSON.parse(JSON.stringify(payload));
  defensive.players[0].posted_markets = ['TOV'];
  defensive.players[0].provenance = { prizepicks: ['TOV'] };
  defensive.players[0].scores = {
    TOV: {
      season: { components: { traditional: { value: 0.08, thin: false } } },
      last_15: { components: { traditional: { value: -0.02, thin: false } }, blend: null },
    },
  };
  expect(decodeMatchup(defensive).players[0].scores.TOV).toEqual(
    expect.objectContaining({
      season: expect.objectContaining({ blend: null }),
      last15: expect.objectContaining({ blend: null }),
    }),
  );

  const missingOffensiveBlend = JSON.parse(JSON.stringify(payload));
  delete missingOffensiveBlend.players[0].scores.PTS.season.blend;
  expect(() => decodeMatchup(missingOffensiveBlend)).toThrow('invalid response');

  const inventedDefensiveBlend = JSON.parse(JSON.stringify(defensive));
  inventedDefensiveBlend.players[0].scores.TOV.season.blend = { value: 0.08, thin: false };
  expect(() => decodeMatchup(inventedDefensiveBlend)).toThrow('invalid response');
});

test('accepts a null offensive Blend only when zero components are computable', () => {
  const zeroComponents = JSON.parse(JSON.stringify(payload));
  zeroComponents.players[0].scores.PTS.last_15 = { components: {}, blend: null };
  expect(decodeMatchup(zeroComponents).players[0].scores.PTS.last15).toEqual({
    components: {},
    blend: null,
  });

  const componentWithoutBlend = JSON.parse(JSON.stringify(zeroComponents));
  componentWithoutBlend.players[0].scores.PTS.last_15.components = {
    play_types: { value: 0.08, thin: false },
  };
  expect(() => decodeMatchup(componentWithoutBlend)).toThrow('invalid response');

  const inventedBlend = JSON.parse(JSON.stringify(zeroComponents));
  inventedBlend.players[0].scores.PTS.last_15.blend = { value: 0, thin: true };
  expect(() => decodeMatchup(inventedBlend)).toThrow('invalid response');
});

test.each([
  ['null component', { play_types: null }],
  ['component without value', { play_types: { thin: false } }],
  ['component without thin', { play_types: { value: 0.08 } }],
  ['component with nonnumeric value', { play_types: { value: '0.08', thin: false } }],
  ['component with nonboolean thin', { play_types: { value: 0.08, thin: 'false' } }],
  ['component with an invented field', { play_types: { value: 0.08, thin: false, note: 'x' } }],
])('rejects a %s score-cell shape', (_name, components) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.players[0].scores.PTS.season.components = components;
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test.each([
  ['Blend without value', { thin: false }],
  ['Blend without thin', { value: 0.08 }],
  ['Blend with nonnumeric value', { value: '0.08', thin: false }],
  ['Blend with nonboolean thin', { value: 0.08, thin: 0 }],
  ['Blend with an invented field', { value: 0.08, thin: false, note: 'x' }],
])('rejects a %s score-cell shape', (_name, blend) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.players[0].scores.PTS.season.blend = blend;
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('decodes the complete governed backend market set and both score encodings', () => {
  const markets = [
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
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.players[0].posted_markets = markets;
  candidate.players[0].provenance = { prizepicks: markets };
  candidate.players[0].scores = Object.fromEntries(
    markets.map((market) => {
      const defensive = ['TOV', 'STL', 'BLK', 'STKS'].includes(market);
      const window = defensive
        ? { components: { traditional: { value: 0.03, thin: false } } }
        : {
            components: { play_types: { value: 0.03, thin: market === 'PRA' } },
            blend: { value: 0.03, thin: market === 'PRA' },
          };
      return [market, { season: window, last_15: window }];
    }),
  );
  candidate.players[0].scores.FG3A.last_15 = { components: {}, blend: null };

  expect(Object.keys(decodeMatchup(candidate).players[0].scores)).toEqual(markets);
});

test.each([
  [
    'an unposted score row',
    (candidate) => {
      candidate.players[0].scores.REB = candidate.players[0].scores.PTS;
    },
  ],
  [
    'an unknown posted market',
    (candidate) => {
      candidate.players[0].posted_markets.push('FANTASY');
      candidate.players[0].provenance.prizepicks.push('FANTASY');
      candidate.players[0].scores.FANTASY = candidate.players[0].scores.PTS;
    },
  ],
  [
    'a duplicate posted market',
    (candidate) => {
      candidate.players[0].posted_markets.push('PTS');
    },
  ],
  [
    'an unknown component Base',
    (candidate) => {
      candidate.players[0].scores.PTS.season.components = {
        pace: { value: 0.08, thin: false },
      };
    },
  ],
  [
    'a non-traditional defensive component',
    (candidate) => {
      candidate.players[0].posted_markets = ['TOV'];
      candidate.players[0].provenance = { prizepicks: ['TOV'] };
      candidate.players[0].scores = {
        TOV: {
          season: { components: { shot_zones: { value: 0.08, thin: false } } },
          last_15: { components: {} },
        },
      };
    },
  ],
  [
    'an invented score window',
    (candidate) => {
      candidate.players[0].scores.PTS.rolling_10 = candidate.players[0].scores.PTS.season;
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test.each([
  ['missing windows', { ...payload, teams: [{ ...payload.teams[0], defense_sheet: {} }] }],
  [
    'invented injury status',
    {
      ...payload,
      injuries: { ...payload.injuries, status: 'fresh-ish' },
    },
  ],
  [
    'invalid freshness status',
    {
      ...payload,
      freshness: { ...payload.freshness, stats: { status: 'fresh-ish', retrieved_at: null } },
    },
  ],
  ['invalid game', { ...payload, game: { ...payload.game, scheduled_at: 'not-a-date' } }],
  ['missing league', { ...payload, league: undefined }],
  [
    'missing matching league row',
    {
      ...payload,
      league: {
        ...payload.league,
        defense_sheet: { ...payload.league.defense_sheet, play_types: [] },
      },
    },
  ],
  [
    'missing defensive column league denominator',
    {
      ...payload,
      league: {
        ...payload.league,
        defensive_columns: Object.fromEntries(
          Object.entries(payload.league.defensive_columns).filter(([key]) => key !== 'OPP_BLK'),
        ),
      },
    },
  ],
  [
    'string canonical player id',
    { ...payload, players: [{ ...payload.players[0], canonical_id: '2544' }] },
  ],
  [
    'uncovered posted market provenance',
    { ...payload, players: [{ ...payload.players[0], provenance: { prizepicks: ['PTS'] } }] },
  ],
  [
    'unposted provenance category',
    {
      ...payload,
      players: [{ ...payload.players[0], provenance: { prizepicks: ['PTS', 'REB'] } }],
    },
  ],
])('rejects %s at the response boundary', (_name, candidate) => {
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('strictly decodes combo, attempts, and AVG rows from the raw selection response', () => {
  const raw = {
    player_id: 2544,
    h2h: {
      thin: false,
      rows: [
        {
          row_type: 'game',
          game_date: '2025-12-25',
          matchup: 'LAL vs. BOS',
          minutes: 36,
          stats: { PRA: 48, FGA: 19 },
          deltas: { PRA: 0.102, FGA: 0.018 },
        },
        {
          row_type: 'average',
          game_date: null,
          matchup: null,
          minutes: 36,
          stats: { PRA: 48, FGA: 19 },
          deltas: { PRA: 0.102, FGA: 0.018 },
        },
      ],
    },
    archetype: { thin: false, rows: [] },
  };
  const selection = decodeMatchupSelection(raw, ['PRA', 'FGA'], 2544);
  expect(selection.h2h.rows.at(-1)).toEqual(
    expect.objectContaining({ average: true, deltas: { PRA: 0.102, FGA: 0.018 } }),
  );
  expect(selection.archetype.rows).toEqual([]);
  expect(() => decodeMatchupSelection(raw, ['PRA', 'AST'], 2544)).toThrow(
    'selection endpoint returned an invalid response',
  );
  expect(() => decodeMatchupSelection(raw, ['PRA', 'FGA'], 1630559)).toThrow(
    'selection endpoint returned an invalid response',
  );
  expect(() =>
    decodeMatchupSelection({ ...raw, h2h: { ...raw.h2h, thin: 'yes' } }, ['PRA', 'FGA'], 2544),
  ).toThrow('selection endpoint returned an invalid response');
});

test('selection requests keep the game string and canonical player integer distinct', async () => {
  const response = {
    player_id: 2544,
    h2h: { thin: false, rows: [] },
    archetype: { thin: false, rows: [] },
  };
  apiClient.get.mockResolvedValueOnce({ data: response });
  await expect(fetchMatchupSelection('0022500584', 2544, ['PTS'])).resolves.toEqual(
    expect.objectContaining({ playerId: 2544 }),
  );
  expect(apiClient.get).toHaveBeenCalledWith('/api/games/matchup/selection', {
    params: { game_id: '0022500584', player_id: 2544 },
    signal: undefined,
  });
  await expect(fetchMatchupSelection('0022500584', '2544', ['PTS'])).rejects.toThrow(
    'selection endpoint returned an invalid response',
  );
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});
