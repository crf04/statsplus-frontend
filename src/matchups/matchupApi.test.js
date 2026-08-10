import { decodeMatchup, decodeMatchupSelection } from './matchupApi';

const payload = {
  game: {
    game_id: '0022500584',
    away_team: { team_id: 1, tricode: 'LAL', name: 'Los Angeles Lakers' },
    home_team: { team_id: 2, tricode: 'BOS', name: 'Boston Celtics' },
    scheduled_at: '2026-01-16T00:30:00Z',
    status: { state: 'scheduled', label: 'Scheduled' },
    preseason: false,
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
      defense_sheet: { play_types: [] },
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
      canonical_id: 'lebron-james',
      name: 'LeBron James',
      team_id: 1,
      tricode: 'LAL',
      posted_markets: ['PTS', 'FGA'],
      season_scoring: 25.4,
      last_10_minutes: [35, 36],
      diet_shares: {
        play_types: [
          {
            key: 'transition',
            season: { share: 0.19, volume_per_game: 5.1 },
            last_15: { share: 0.2, volume_per_game: 5.3 },
          },
        ],
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
    injuries: { status: 'missing', retrieved_at: null },
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
      id: 'lebron-james',
      postedMarkets: ['PTS', 'FGA'],
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
])('rejects %s at the response boundary', (_name, candidate) => {
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('strictly decodes combo, attempts, and AVG rows from the raw selection response', () => {
  const raw = {
    player_id: 'lebron-james',
    h2h: {
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
    archetype: { rows: [] },
  };
  const selection = decodeMatchupSelection(raw, ['PRA', 'FGA'], 'lebron-james');
  expect(selection.h2h.rows.at(-1)).toEqual(
    expect.objectContaining({ average: true, deltas: { PRA: 0.102, FGA: 0.018 } }),
  );
  expect(selection.archetype.rows).toEqual([]);
  expect(() => decodeMatchupSelection(raw, ['PRA', 'AST'], 'lebron-james')).toThrow(
    'selection endpoint returned an invalid response',
  );
  expect(() => decodeMatchupSelection(raw, ['PRA', 'FGA'], 'another-player')).toThrow(
    'selection endpoint returned an invalid response',
  );
  expect(() =>
    decodeMatchupSelection(
      { ...raw, h2h: { ...raw.h2h, thin: 'yes' } },
      ['PRA', 'FGA'],
      'lebron-james',
    ),
  ).toThrow('selection endpoint returned an invalid response');
});
