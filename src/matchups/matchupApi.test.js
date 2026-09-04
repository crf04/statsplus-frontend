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
          key: 'Transition:PTS',
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
            key: 'Transition:PTS',
            label: 'Transition PTS',
            markets: ['PTS', 'PA', 'PR', 'PRA'],
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
            key: 'Transition',
            season: {
              share: 0.19,
              volume: 102,
              games_played: 20,
              volume_unit: 'possessions',
              league_average_share: 0.09,
              sigma_deviation: 1.3,
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
      markets: ['PTS', 'PA', 'PR', 'PRA'],
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
    key: 'Transition:PTS',
    sliceKey: 'Transition',
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
            key: 'Handoff:PTS',
            season: { average_allowed_per_48: 7.2, sigma: 0.7 },
            last_15: { average_allowed_per_48: 7.4, sigma: 0.8 },
          },
        ],
      },
    },
  };
  expect(decodeMatchup(extraLeagueRow).league.defenseSheet.playTypes).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: 'Handoff:PTS', sliceKey: 'Handoff' })]),
  );
});

test('ignores undisplayed additive rows from backend-projected Bases', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  const leagueWindow = { average_allowed_per_48: 7.2, sigma: 0.7 };
  const teamWindow = {
    allowed_per_48: 7.8,
    percent_vs_league_average: 8,
    sigma_deviation: 0.8,
    rank: 22,
  };
  const extras = [
    {
      base: 'traditional',
      league: { key: 'OPP_PF', season: leagueWindow, last_15: leagueWindow },
      team: {
        key: 'OPP_PF',
        label: 'Opponent fouls',
        markets: [],
        season: teamWindow,
        last_15: teamWindow,
      },
    },
    {
      base: 'assist_locations',
      league: { key: 'Assists', season: leagueWindow, last_15: leagueWindow },
      team: {
        key: 'Assists',
        label: 'Assists',
        markets: ['AST'],
        season: teamWindow,
        last_15: teamWindow,
      },
    },
    {
      base: 'play_types',
      league: { key: 'Backcourt:PTS', season: leagueWindow, last_15: leagueWindow },
      team: {
        key: 'Backcourt:PTS',
        label: 'Backcourt PTS',
        markets: ['PTS'],
        season: teamWindow,
        last_15: teamWindow,
      },
    },
    {
      base: 'play_types',
      league: { key: 'Misc:PTS', season: leagueWindow, last_15: leagueWindow },
      team: {
        key: 'Misc:PTS',
        label: 'Misc PTS',
        markets: ['PTS', 'PA', 'PR', 'PRA'],
        season: teamWindow,
        last_15: teamWindow,
      },
    },
  ];
  extras.forEach(({ base, league, team }) => {
    candidate.league.defense_sheet[base].push(league);
    candidate.teams[0].defense_sheet[base].push(team);
  });

  const decoded = decodeMatchup(candidate);
  expect(decoded.league.defenseSheet.traditional.map((row) => row.key)).not.toContain('OPP_PF');
  expect(decoded.league.defenseSheet.assistLocations.map((row) => row.key)).not.toContain(
    'Assists',
  );
  expect(decoded.league.defenseSheet.playTypes.map((row) => row.key)).not.toContain(
    'Backcourt:PTS',
  );
  expect(decoded.league.defenseSheet.playTypes.map((row) => row.key)).not.toContain('Misc:PTS');
  expect(decoded.teams[0].defenseSheet.traditional.map((row) => row.key)).not.toContain('OPP_PF');
  expect(decoded.teams[0].defenseSheet.assistLocations.map((row) => row.key)).not.toContain(
    'Assists',
  );
  expect(decoded.teams[0].defenseSheet.playTypes.map((row) => row.key)).not.toContain(
    'Backcourt:PTS',
  );
  expect(decoded.teams[0].defenseSheet.playTypes.map((row) => row.key)).not.toContain('Misc:PTS');
});

test.each([
  ['a malformed suffix on a recognized play type', 'play_types', 'Transition:PPP'],
  ['an undisplayed shot zone', 'shot_zones', 'Backcourt:FGA'],
  ['an undisplayed shot type', 'shot_types', 'Floaters:FG2A'],
])('rejects %s', (_label, base, key) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.league.defense_sheet[base] = [
    {
      key,
      season: { average_allowed_per_48: 10, sigma: 1 },
      last_15: { average_allowed_per_48: 10, sigma: 1 },
    },
  ];
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('rejects malformed markets on a recognized additive-Base row', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.teams[0].defense_sheet.play_types[0].markets = ['PTS'];
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('derives canonical governed Diet slice identities from backend sheet row keys', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.league.defense_sheet.play_types[0].key = 'Transition:PTS';
  candidate.teams[0].defense_sheet.play_types[0].key = 'Transition:PTS';
  candidate.teams[0].defense_sheet.play_types[0].label = 'Transition PTS';
  candidate.teams[0].defense_sheet.play_types[0].markets = ['PTS', 'PA', 'PR', 'PRA'];
  candidate.league.defense_sheet.shot_zones = [
    {
      key: 'Restricted Area:FGA',
      season: { average_allowed_per_48: 30, sigma: 2 },
      last_15: { average_allowed_per_48: 29, sigma: 1.8 },
    },
  ];
  candidate.teams[0].defense_sheet.shot_zones = [
    {
      key: 'Restricted Area:FGA',
      label: 'Restricted Area FGA',
      markets: ['FGA', 'FG2A'],
      season: {
        allowed_per_48: 32,
        percent_vs_league_average: 7,
        sigma_deviation: 1.2,
        rank: 24,
      },
      last_15: {
        allowed_per_48: 31,
        percent_vs_league_average: 6,
        sigma_deviation: 1.1,
        rank: 22,
      },
    },
  ];
  candidate.league.defense_sheet.shot_types = [
    {
      key: 'Catch and Shoot:FG3A',
      season: { average_allowed_per_48: 7, sigma: 1 },
      last_15: { average_allowed_per_48: 6.8, sigma: 0.9 },
    },
  ];
  candidate.teams[0].defense_sheet.shot_types = [
    {
      key: 'Catch and Shoot:FG3A',
      label: 'Catch and Shoot FG3A',
      markets: ['FGA', 'FG3A'],
      season: {
        allowed_per_48: 8,
        percent_vs_league_average: 14,
        sigma_deviation: 1.4,
        rank: 27,
      },
      last_15: {
        allowed_per_48: 7.7,
        percent_vs_league_average: 13,
        sigma_deviation: 1.3,
        rank: 26,
      },
    },
  ];
  candidate.league.defense_sheet.assist_locations = [
    {
      key: 'AtRimAssists',
      season: { average_allowed_per_48: 10, sigma: 0.8 },
      last_15: { average_allowed_per_48: 9.8, sigma: 0.7 },
    },
  ];
  candidate.teams[0].defense_sheet.assist_locations = [
    {
      key: 'AtRimAssists',
      label: 'AtRimAssists',
      markets: ['AST', 'PA', 'RA', 'PRA'],
      season: {
        allowed_per_48: 12,
        percent_vs_league_average: 13,
        sigma_deviation: 1.5,
        rank: 28,
      },
      last_15: {
        allowed_per_48: 11,
        percent_vs_league_average: 9,
        sigma_deviation: 1.1,
        rank: 24,
      },
    },
  ];

  const decoded = decodeMatchup(candidate);
  expect(decoded.teams[0].defenseSheet.playTypes[0].sliceKey).toBe('Transition');
  expect(decoded.teams[0].defenseSheet.shotZones[0].sliceKey).toBe('Restricted Area');
  expect(decoded.teams[0].defenseSheet.shotTypes[0].sliceKey).toBe('Catch and Shoot');
  expect(decoded.teams[0].defenseSheet.assistLocations[0].sliceKey).toBe('AtRimAssists');
  expect(decoded.league.defenseSheet.shotZones[0].sliceKey).toBe('Restricted Area');
  expect(decoded.league.defenseSheet.shotTypes[0].sliceKey).toBe('Catch and Shoot');
});

test.each([
  ['an ungoverned slice', 'Paint:FGA'],
  ['a missing stat suffix', 'Restricted Area'],
  ['a stat outside the Base taxonomy', 'Restricted Area:FG3A'],
])('rejects %s instead of guessing a sheet slice identity', (_label, key) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.league.defense_sheet.shot_zones = [
    {
      key,
      season: { average_allowed_per_48: 30, sigma: 2 },
      last_15: { average_allowed_per_48: 29, sigma: 1.8 },
    },
  ];
  candidate.teams[0].defense_sheet.shot_zones = [
    {
      key,
      label: key,
      markets: ['FGA', 'FG2A'],
      season: {
        allowed_per_48: 32,
        percent_vs_league_average: 7,
        sigma_deviation: 1.2,
        rank: 24,
      },
      last_15: {
        allowed_per_48: 31,
        percent_vs_league_average: 6,
        sigma_deviation: 1.1,
        rank: 22,
      },
    },
  ];
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('rejects a sheet row whose markets do not match its governed slice and stat', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.league.defense_sheet.shot_zones = [
    {
      key: 'Restricted Area:FGA',
      season: { average_allowed_per_48: 30, sigma: 2 },
      last_15: { average_allowed_per_48: 29, sigma: 1.8 },
    },
  ];
  candidate.teams[0].defense_sheet.shot_zones = [
    {
      key: 'Restricted Area:FGA',
      label: 'Restricted Area FGA',
      markets: ['FGA', 'FG3A'],
      season: {
        allowed_per_48: 32,
        percent_vs_league_average: 7,
        sigma_deviation: 1.2,
        rank: 24,
      },
      last_15: {
        allowed_per_48: 31,
        percent_vs_league_average: 6,
        sigma_deviation: 1.1,
        rank: 22,
      },
    },
  ];
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
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
        key: 'Transition',
        season: {
          share: 0.19,
          volume: 95,
          games_played: 20,
          volume_unit: 'possessions',
          // Baseline population smaller than 2 players reports nulls.
          league_average_share: null,
          sigma_deviation: null,
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
    key: 'Transition',
    season: {
      share: 0.19,
      volume: 95,
      gamesPlayed: 20,
      volumeUnit: 'possessions',
      volumePerGame: 4.75,
      leagueAverageShare: null,
      sigmaDeviation: null,
    },
  });
});

test.each([
  ['Season', 'season', 'last_15'],
  ['Last 15', 'last_15', 'season'],
])(
  'accepts an asymmetric null %s OPP_REB row under available traditional data',
  (_label, nullWindow, valueWindow) => {
    const candidate = JSON.parse(JSON.stringify(payload));
    const leagueValue = { average_allowed_per_48: 46, sigma: 1.4 };
    const teamValue = {
      allowed_per_48: 45,
      percent_vs_league_average: -8,
      sigma_deviation: -1.2,
      rank: 4,
    };
    candidate.league.defense_sheet.traditional = [
      { key: 'OPP_REB', [nullWindow]: null, [valueWindow]: leagueValue },
    ];
    candidate.teams.forEach((team) => {
      team.defense_sheet.traditional = [
        {
          key: 'OPP_REB',
          label: 'Opponent rebounds',
          markets: ['REB', 'PR', 'RA', 'PRA'],
          [nullWindow]: null,
          [valueWindow]: teamValue,
        },
      ];
    });

    const decoded = decodeMatchup(candidate);
    expect(
      decoded.league.defenseSheet.traditional[0][nullWindow === 'season' ? 'season' : 'last15'],
    ).toBeNull();
    expect(
      decoded.teams[0].defenseSheet.traditional[0][nullWindow === 'season' ? 'season' : 'last15'],
    ).toBeNull();
    expect(decoded.teams[0].defenseSheet.traditional[0].sliceKey).toBe('OPP_REB');
  },
);

test.each([
  {
    label: 'the delivered team value is zero',
    leagueSheetAverage: 16.4,
    teamSheetValue: 0,
    leagueColumnAverage: 4.9,
    teamColumnValue: 0,
  },
  {
    label: 'the matching league average is zero',
    leagueSheetAverage: 0,
    teamSheetValue: 7.5,
    leagueColumnAverage: 0,
    teamColumnValue: 2.5,
  },
])(
  'accepts a null relative percentage when $label',
  ({ leagueSheetAverage, teamSheetValue, leagueColumnAverage, teamColumnValue }) => {
    const candidate = JSON.parse(JSON.stringify(payload));
    candidate.league.defense_sheet.play_types[0].season.average_allowed_per_48 = leagueSheetAverage;
    candidate.league.defensive_columns.OPP_BLK.season.average_per_48 = leagueColumnAverage;
    candidate.teams[0].defense_sheet.play_types[0].season = {
      allowed_per_48: teamSheetValue,
      percent_vs_league_average: null,
      sigma_deviation: 1.4,
      rank: 1,
    };
    candidate.teams[0].defensive_columns.OPP_BLK.season = {
      per_48: teamColumnValue,
      percent_vs_league_average: null,
    };

    const decoded = decodeMatchup(candidate);
    expect(decoded.teams[0].defenseSheet.playTypes[0].season).toEqual({
      allowedPer48: teamSheetValue,
      percentVsLeagueAverage: null,
      sigmaDeviation: 1.4,
      rank: 1,
    });
    expect(decoded.teams[0].defensiveColumns.OPP_BLK.season).toEqual({
      per48: teamColumnValue,
      percentVsLeagueAverage: null,
    });
  },
);

test.each([
  [
    'sheet window',
    (candidate) =>
      (candidate.teams[0].defense_sheet.play_types[0].season.percent_vs_league_average = null),
  ],
  [
    'defensive-column window',
    (candidate) =>
      (candidate.teams[0].defensive_columns.OPP_BLK.season.percent_vs_league_average = null),
  ],
])('rejects a null relative percentage on a nonzero %s', (_label, mutate) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test.each(['allowed_per_48', 'sigma_deviation', 'rank'])(
  'keeps structural-zero sheet field %s numeric',
  (field) => {
    const candidate = JSON.parse(JSON.stringify(payload));
    candidate.league.defense_sheet.play_types[0].season.average_allowed_per_48 = 0;
    candidate.teams[0].defense_sheet.play_types[0].season = {
      allowed_per_48: 0,
      percent_vs_league_average: null,
      sigma_deviation: 0,
      rank: 1,
      [field]: null,
    };
    expect(() => decodeMatchup(candidate)).toThrow('invalid response');
  },
);

test('keeps structural-zero defensive-column per_48 numeric', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.league.defensive_columns.OPP_BLK.season.average_per_48 = 0;
  candidate.teams[0].defensive_columns.OPP_BLK.season = {
    per_48: null,
    percent_vs_league_average: null,
  };
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test.each([
  ['another traditional row', 'traditional', 'OPP_TOV'],
  ['another Base row', 'play_types', 'Transition:PTS'],
])('rejects a null available window on %s', (_label, base, key) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.league.defense_sheet[base] = [
    { key, season: null, last_15: { average_allowed_per_48: 10, sigma: 1 } },
  ];
  candidate.teams.forEach((team) => {
    team.defense_sheet[base] = [
      {
        key,
        label: key,
        markets: base === 'traditional' ? ['TOV'] : ['PTS', 'PA', 'PR', 'PRA'],
        season: null,
        last_15: {
          allowed_per_48: 10,
          percent_vs_league_average: 0,
          sigma_deviation: 0,
          rank: 15,
        },
      },
    ];
  });

  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
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
  [
    'a Diet Share missing league_average_share',
    (candidate) => {
      delete candidate.players[0].diet_shares.play_types[0].season.league_average_share;
    },
  ],
  [
    'a Diet Share missing sigma_deviation',
    (candidate) => {
      delete candidate.players[0].diet_shares.play_types[0].season.sigma_deviation;
    },
  ],
  [
    'a Diet Share with a non-numeric league_average_share',
    (candidate) => {
      candidate.players[0].diet_shares.play_types[0].season.league_average_share = '0.09';
    },
  ],
  [
    'a Diet Share with a non-numeric sigma_deviation',
    (candidate) => {
      candidate.players[0].diet_shares.play_types[0].season.sigma_deviation = '1.3';
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('accepts both backend unavailable-injury envelopes and rejects partial team envelopes', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.injuries.teams = [
    { team_id: 1, tricode: 'LAL', submission_state: 'unknown', entries: [] },
    { team_id: 2, tricode: 'BOS', submission_state: 'unknown', entries: [] },
  ];
  expect(decodeMatchup(candidate).injuries.teams).toHaveLength(2);

  const partial = JSON.parse(JSON.stringify(candidate));
  partial.injuries.teams.pop();
  expect(() => decodeMatchup(partial)).toThrow('invalid response');

  const wrongTeam = JSON.parse(JSON.stringify(candidate));
  wrongTeam.injuries.teams[1].team_id = 3;
  expect(() => decodeMatchup(wrongTeam)).toThrow('invalid response');
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
  zeroComponents.players[0].scores.FGA.last_15 = { components: {}, blend: null };
  expect(decodeMatchup(zeroComponents).players[0].scores.FGA.last15).toEqual({
    components: {},
    blend: null,
    missingInputs: [],
  });

  const componentWithoutBlend = JSON.parse(JSON.stringify(zeroComponents));
  componentWithoutBlend.players[0].scores.FGA.last_15.components = {
    shot_zones: { value: 0.08, thin: false },
  };
  expect(() => decodeMatchup(componentWithoutBlend)).toThrow('invalid response');

  const inventedBlend = JSON.parse(JSON.stringify(zeroComponents));
  inventedBlend.players[0].scores.FGA.last_15.blend = { value: 0, thin: true };
  expect(() => decodeMatchup(inventedBlend)).toThrow('invalid response');
});

test.each([
  ['null component', { play_types: null }],
  ['component without value', { play_types: { thin: false } }],
  ['component without thin', { play_types: { value: 0.08 } }],
  ['component with nonnumeric value', { play_types: { value: '0.08', thin: false } }],
  ['component with nonboolean thin', { play_types: { value: 0.08, thin: 'false' } }],
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
])('rejects a %s score-cell shape', (_name, blend) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.players[0].scores.PTS.season.blend = blend;
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('tolerates additive fields on forward-compatible low-level contract objects', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.league.surface_availability.play_types.season.observed_at = '2026-01-15T10:00:00Z';
  candidate.players[0].diet_shares.play_types[0].provider = 'nba_stats';
  candidate.players[0].diet_shares.play_types[0].season.sample_note = 'complete';
  candidate.players[0].scores.PTS.season.components.play_types.provider = 'nba_stats';
  candidate.players[0].scores.PTS.season.blend.formula_version = 2;
  candidate.players[0].scores.PTS.season.explanation = 'additive metadata';

  expect(decodeMatchup(candidate)).toEqual(
    expect.objectContaining({
      players: expect.arrayContaining([
        expect.objectContaining({
          scores: expect.objectContaining({
            PTS: expect.objectContaining({
              season: expect.objectContaining({ blend: { value: 0.12, thin: false } }),
            }),
          }),
        }),
      ]),
    }),
  );
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

const experienceSection = (status, source, context, unavailableReason = null) => ({
  status,
  source,
  context,
  unavailable_reason: unavailableReason,
});

// A completed game with no point-in-time snapshot: the Last-15 Surfaces are
// unavailable, so the Last-15 section can truthfully say so.
const withoutPointInTimeWindow = (candidate) => {
  Object.values(candidate.league.surface_availability).forEach((windows) => {
    windows.last_15 = { status: 'unavailable', unavailable_reason: 'no_point_in_time_snapshot' };
  });
  [candidate.league, ...candidate.teams].forEach((holder) => {
    Object.values(holder.defense_sheet).forEach((rows) =>
      rows.forEach((row) => {
        row.last_15 = null;
      }),
    );
    Object.values(holder.defensive_columns).forEach((column) => {
      column.last_15 = null;
    });
  });
  return candidate;
};

const historicalPayload = ({ pointInTime = false } = {}) => {
  const raw = JSON.parse(JSON.stringify(payload));
  const candidate = pointInTime ? raw : withoutPointInTimeWindow(raw);
  candidate.game.status = { state: 'final', label: 'Final' };
  candidate.experience = {
    mode: 'historical',
    player_source: 'game_logs',
    sections: {
      schedule: experienceSection('available', 'event_catalog', 'completed_season_catalog'),
      participants: experienceSection('available', 'player_game_logs', 'completed_season'),
      season_defense: experienceSection(
        'available',
        'team_matchup_publication',
        'completed_season',
      ),
      last_15_defense: experienceSection('unavailable', null, null, 'no_point_in_time_snapshot'),
      injuries: experienceSection('unavailable', null, null, 'no_pregame_snapshot'),
    },
  };
  const participant = candidate.players[0];
  participant.posted_markets = [];
  participant.provenance = {};
  participant.player_source = 'game_logs';
  participant.stat_categories = ['PTS', 'FGA'];
  // The focal line is evidence about this matchup's own game, so its game,
  // date, and matchup identity all have to be that game's.
  participant.focal_game_line = {
    game_id: candidate.game.game_id,
    game_date: '2026-01-15',
    matchup: 'LAL @ BOS',
    minutes: 34.5,
    stats: { PTS: 24, FGA: 18 },
  };
  return candidate;
};

test('reads the additive Historical Matchup mode and section-owned evidence', () => {
  const decoded = decodeMatchup(historicalPayload());

  expect(decoded.experience.mode).toBe('historical');
  expect(decoded.experience.playerSource).toBe('game_logs');
  expect(decoded.experience.sections.seasonDefense).toEqual({
    status: 'available',
    source: 'team_matchup_publication',
    context: 'completed_season',
    unavailableReason: null,
    collectedAt: null,
  });
  expect(decoded.experience.sections.last15Defense).toEqual({
    status: 'unavailable',
    source: null,
    context: null,
    unavailableReason: 'no_point_in_time_snapshot',
    collectedAt: null,
  });
  expect(decoded.experience.sections.participants.source).toBe('player_game_logs');
  expect(decoded.experience.sections.injuries.unavailableReason).toBe('no_pregame_snapshot');
});

test('reads schedule collection provenance without letting it govern any section', () => {
  const candidate = historicalPayload();
  candidate.experience.sections.schedule.collected_at = '2026-03-30T04:10:00Z';

  const { sections } = decodeMatchup(candidate).experience;
  expect(sections.schedule.collectedAt).toBe('2026-03-30T04:10:00.000Z');
  expect(sections.schedule.status).toBe('available');
  // Only schedule carries collection provenance.
  expect(sections.participants.collectedAt).toBeNull();
  expect(sections.seasonDefense.collectedAt).toBeNull();

  const absent = historicalPayload();
  expect(decodeMatchup(absent).experience.sections.schedule.collectedAt).toBeNull();
});

test.each([
  [
    'an unparseable schedule collection time',
    (candidate) => {
      candidate.experience.sections.schedule.collected_at = 'not-a-timestamp';
    },
  ],
  [
    'collection provenance on a section that does not carry it',
    (candidate) => {
      candidate.experience.sections.participants.collected_at = '2026-03-30T04:10:00Z';
    },
  ],
  [
    'an undocumented schedule key',
    (candidate) => {
      candidate.experience.sections.schedule.published_at = '2026-03-30T04:10:00Z';
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('treats an absent experience block as the pre-historical live contract', () => {
  const decoded = decodeMatchup(payload);

  expect(decoded.experience).toEqual({
    mode: 'current',
    playerSource: 'player_pool',
    sections: null,
  });
  expect(decoded.players[0].playerSource).toBe('player_pool');
  expect(decoded.players[0].statCategories).toEqual(['PTS', 'FGA']);
  expect(decoded.players[0].focalGameLine).toBeNull();
  expect(decoded.players[0].scores.PTS.season.missingInputs).toEqual([]);
});

test('reads a game-log participant that carries no posted-market claim', () => {
  const [participant] = decodeMatchup(historicalPayload()).players;

  expect(participant.playerSource).toBe('game_logs');
  expect(participant.postedMarkets).toEqual([]);
  expect(participant.provenance).toEqual({});
  expect(participant.statCategories).toEqual(['PTS', 'FGA']);
  expect(participant.focalGameLine).toEqual({
    gameId: payload.game.game_id,
    gameDate: '2026-01-15',
    matchup: 'LAL @ BOS',
    minutes: 34.5,
    stats: { PTS: 24, FGA: 18 },
  });
});

test('names the missing inputs of an incomplete Matchup Score', () => {
  const candidate = historicalPayload();
  candidate.players[0].scores.PTS.last_15 = {
    components: {},
    blend: null,
    missing_inputs: ['team_defense:play_types', 'player_diet:shot_zones', 'player_season_rate'],
  };

  expect(decodeMatchup(candidate).players[0].scores.PTS.last15).toEqual({
    components: {},
    blend: null,
    missingInputs: ['team_defense:play_types', 'player_diet:shot_zones', 'player_season_rate'],
  });
});

test.each([
  [
    'an unknown experience mode',
    (candidate) => {
      candidate.experience.mode = 'archived';
    },
  ],
  [
    'a missing experience section',
    (candidate) => {
      delete candidate.experience.sections.injuries;
    },
  ],
  [
    'an experience section missing a key',
    (candidate) => {
      delete candidate.experience.sections.schedule.context;
    },
  ],
  [
    'an available section that still names an unavailable reason',
    (candidate) => {
      candidate.experience.sections.schedule.unavailable_reason = 'no_pregame_snapshot';
    },
  ],
  [
    'an unavailable section with no reason',
    (candidate) => {
      candidate.experience.sections.last_15_defense.unavailable_reason = null;
    },
  ],
  [
    'an ungoverned section source',
    (candidate) => {
      candidate.experience.sections.participants.source = 'roster_guess';
    },
  ],
  [
    'a posted-market claim on a game-log participant',
    (candidate) => {
      candidate.players[0].posted_markets = ['PTS'];
    },
  ],
  [
    'provenance on a game-log participant',
    (candidate) => {
      candidate.players[0].provenance = { prizepicks: ['PTS'] };
    },
  ],
  [
    'stat categories that disagree with the delivered scores',
    (candidate) => {
      candidate.players[0].stat_categories = ['PTS', 'FGA', 'AST'];
    },
  ],
  [
    'a focal game line missing a governed category',
    (candidate) => {
      delete candidate.players[0].focal_game_line.stats.FGA;
    },
  ],
  [
    'an ungoverned missing-input name',
    (candidate) => {
      candidate.players[0].scores.PTS.season.missing_inputs = ['vibes'];
    },
  ],
  // Cross-field coherence: the declared mode owns its evidence vocabulary.
  [
    'a historical mode that claims a Player Pool source',
    (candidate) => {
      candidate.experience.player_source = 'player_pool';
    },
  ],
  [
    'a historical section described as pregame',
    (candidate) => {
      candidate.experience.sections.season_defense.context = 'pregame';
    },
  ],
  [
    'a historical schedule described as a current-season catalog',
    (candidate) => {
      candidate.experience.sections.schedule.context = 'current_season_catalog';
    },
  ],
  [
    'historical participants sourced from a Player Pool',
    (candidate) => {
      candidate.experience.sections.participants.source = 'player_pool';
    },
  ],
  [
    'a participant that overrides its experience player source',
    (candidate) => {
      candidate.players[0].player_source = 'player_pool';
    },
  ],
  [
    'a historical participant with no focal game line',
    (candidate) => {
      candidate.players[0].focal_game_line = null;
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test.each([
  [
    'a current mode that claims game-log participants',
    (candidate) => {
      candidate.experience.player_source = 'game_logs';
    },
  ],
  [
    'a current section described as completed-season hindsight',
    (candidate) => {
      candidate.experience.sections.season_defense.context = 'completed_season';
    },
  ],
  [
    'current participants sourced from game logs',
    (candidate) => {
      candidate.experience.sections.participants.source = 'player_game_logs';
    },
  ],
  [
    'a pool player carrying a focal game line',
    (candidate) => {
      candidate.players[0].focal_game_line = {
        game_id: '0022500584',
        game_date: '2026-01-15',
        matchup: 'LAL @ BOS',
        minutes: 34,
        stats: { PTS: 24, FGA: 18 },
      };
    },
  ],
  [
    'current stat categories that diverge from the posted markets',
    (candidate) => {
      candidate.players[0].stat_categories = ['FGA', 'PTS'];
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.experience = {
    mode: 'current',
    player_source: 'player_pool',
    sections: {
      schedule: experienceSection('available', 'event_catalog', 'current_season_catalog'),
      participants: experienceSection('available', 'player_pool', 'posted_markets'),
      season_defense: experienceSection('available', 'team_matchup_publication', 'pregame'),
      last_15_defense: experienceSection('available', 'team_matchup_publication', 'pregame'),
      injuries: experienceSection('unavailable', 'rotowire', 'current', 'disabled'),
    },
  };
  // The unmutated current-mode payload must stay decodable.
  expect(() => decodeMatchup(candidate)).not.toThrow();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test.each([
  [
    'a focal game line from a different game',
    (candidate) => {
      candidate.players[0].focal_game_line.game_id = '0022509999';
    },
  ],
  [
    'an available section with no source',
    (candidate) => {
      candidate.experience.sections.participants.source = null;
    },
  ],
  [
    'an available section with no context',
    (candidate) => {
      candidate.experience.sections.season_defense.context = null;
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('binds the focal game line to the decoded matchup game', () => {
  const candidate = historicalPayload();
  candidate.players[0].focal_game_line.game_id = candidate.game.game_id;

  expect(decodeMatchup(candidate).players[0].focalGameLine.gameId).toBe(candidate.game.game_id);
});

const historicalSelection = (overrides = {}) => ({
  player_id: 2544,
  experience: {
    mode: 'historical',
    player_source: 'game_logs',
    focal_game: {
      game_id: '0022500584',
      game_date: '2026-03-29',
      matchup: 'LAC @ MIL',
      minutes: 34.5,
      stats: { PTS: 24, FGA: 18 },
    },
    samples: { context: 'pregame', excludes_focal_game: true },
    baseline: { context: 'completed_season', hindsight: true },
  },
  h2h: { thin: false, rows: [] },
  archetype: { thin: false, rows: [] },
  ...overrides,
});

test('binds historical selection evidence to the requested matchup', () => {
  const expected = { gameId: '0022500584', mode: 'historical' };
  const selection = decodeMatchupSelection(historicalSelection(), ['PTS', 'FGA'], 2544, expected);
  expect(selection.experience.focalGame.gameId).toBe('0022500584');

  // A historical dossier without its experience would silently drop the
  // strict-before and hindsight disclosures the outcome requires.
  expect(() =>
    decodeMatchupSelection(historicalSelection({ experience: undefined }), ['PTS', 'FGA'], 2544, {
      ...expected,
    }),
  ).toThrow('selection endpoint returned an invalid response');

  const otherGame = historicalSelection();
  otherGame.experience.focal_game.game_id = '0022509999';
  expect(() => decodeMatchupSelection(otherGame, ['PTS', 'FGA'], 2544, expected)).toThrow(
    'selection endpoint returned an invalid response',
  );

  const currentDossier = historicalSelection();
  currentDossier.experience.mode = 'current';
  currentDossier.experience.player_source = 'player_pool';
  currentDossier.experience.focal_game = null;
  currentDossier.experience.samples = { context: 'season_to_date', excludes_focal_game: false };
  currentDossier.experience.baseline = { context: 'season_to_date', hindsight: false };
  expect(() => decodeMatchupSelection(currentDossier, ['PTS', 'FGA'], 2544, expected)).toThrow(
    'selection endpoint returned an invalid response',
  );
});

test('leaves the current selection contract unbound to historical evidence', () => {
  const raw = {
    player_id: 2544,
    h2h: { thin: false, rows: [] },
    archetype: { thin: false, rows: [] },
  };

  expect(decodeMatchupSelection(raw, ['PTS'], 2544).experience).toBeNull();
  expect(
    decodeMatchupSelection(raw, ['PTS'], 2544, { gameId: '0022500584', mode: 'current' })
      .experience,
  ).toBeNull();
});

const focalLineOf = (candidate) => candidate.players[0].focal_game_line;
const withOneParticipant = (candidate, participant) => ({
  ...JSON.parse(JSON.stringify(candidate)),
  players: [JSON.parse(JSON.stringify(participant))],
});

test.each([
  [
    'a participant on neither focal team',
    (candidate) => {
      candidate.players[0].team_id = 99;
    },
  ],
  [
    'a participant whose tricode contradicts its focal team',
    (candidate) => {
      candidate.players[0].tricode = 'BOS';
    },
  ],
  [
    'a focal line naming a matchup other than the decoded one',
    (candidate) => {
      focalLineOf(candidate).matchup = 'LAC @ MIL';
    },
  ],
  [
    'a focal line dated away from the decoded game',
    (candidate) => {
      focalLineOf(candidate).game_date = '2026-03-29';
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('accepts the home participant game-log matchup identity', () => {
  const candidate = historicalPayload();
  const homeParticipant = JSON.parse(JSON.stringify(candidate.players[0]));
  homeParticipant.canonical_id = 1630559;
  homeParticipant.name = 'Home Participant';
  homeParticipant.team_id = candidate.game.home_team.team_id;
  homeParticipant.tricode = candidate.game.home_team.tricode;
  homeParticipant.focal_game_line.matchup = 'BOS vs. LAL';

  expect(() => decodeMatchup(withOneParticipant(candidate, homeParticipant))).not.toThrow();
});

test.each([
  [
    'a home participant carrying the away matchup form',
    (candidate) => {
      candidate.players[0].team_id = candidate.game.home_team.team_id;
      candidate.players[0].tricode = candidate.game.home_team.tricode;
      candidate.players[0].focal_game_line.matchup = 'LAL @ BOS';
    },
  ],
  [
    'an away participant carrying the home matchup form',
    (candidate) => {
      candidate.players[0].focal_game_line.matchup = 'BOS vs. LAL';
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('rejects participants that disagree about which game is focal', () => {
  const candidate = historicalPayload();
  const second = JSON.parse(JSON.stringify(candidate.players[0]));
  second.canonical_id = 1630559;
  second.name = 'Austin Reaves';
  // Both dates are individually allowed for a 2026-01-16T00:30Z tip, so only
  // the cross-participant agreement guard can reject this pair.
  expect(candidate.players[0].focal_game_line.game_date).toBe('2026-01-15');
  second.focal_game_line.game_date = '2026-01-16';
  expect(() => decodeMatchup(withOneParticipant(candidate, second))).not.toThrow();
  candidate.players.push(second);

  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

const historicalDossier = (overrides = {}) => ({
  player_id: 2544,
  experience: {
    mode: 'historical',
    player_source: 'game_logs',
    focal_game: {
      game_id: '0022500584',
      game_date: '2026-01-15',
      matchup: 'LAL @ BOS',
      minutes: 34.5,
      stats: { PTS: 24, FGA: 18 },
    },
    samples: { context: 'pregame', excludes_focal_game: true },
    baseline: { context: 'completed_season', hindsight: true },
  },
  h2h: {
    thin: false,
    rows: [
      {
        row_type: 'game',
        game_date: '2025-12-25',
        matchup: 'LAL vs. BOS',
        minutes: 33,
        stats: { PTS: 21, FGA: 17 },
        deltas: { PTS: 0.06, FGA: 0.01 },
      },
      {
        row_type: 'average',
        game_date: null,
        matchup: null,
        minutes: 33,
        stats: { PTS: 21, FGA: 17 },
        deltas: { PTS: 0.06, FGA: 0.01 },
      },
    ],
  },
  archetype: { thin: false, rows: [] },
  ...overrides,
});

const focalExpectation = {
  gameId: '0022500584',
  mode: 'historical',
  focalGameLine: {
    gameId: '0022500584',
    gameDate: '2026-01-15',
    matchup: 'LAL @ BOS',
    minutes: 34.5,
    stats: { PTS: 24, FGA: 18 },
  },
};

test('keeps historical samples strictly before the focal game', () => {
  expect(
    decodeMatchupSelection(historicalDossier(), ['PTS', 'FGA'], 2544, focalExpectation).h2h.rows,
  ).toHaveLength(2);

  const onFocalDay = historicalDossier();
  onFocalDay.h2h.rows[0].game_date = '2026-01-15';
  expect(() => decodeMatchupSelection(onFocalDay, ['PTS', 'FGA'], 2544, focalExpectation)).toThrow(
    'selection endpoint returned an invalid response',
  );

  const afterFocal = historicalDossier();
  afterFocal.archetype = {
    thin: false,
    rows: [{ ...onFocalDay.h2h.rows[0], game_date: '2026-02-02' }, { ...onFocalDay.h2h.rows[1] }],
  };
  expect(() => decodeMatchupSelection(afterFocal, ['PTS', 'FGA'], 2544, focalExpectation)).toThrow(
    'selection endpoint returned an invalid response',
  );
});

test.each([
  [
    'a dossier focal game dated away from the participant evidence',
    (dossier) => {
      dossier.experience.focal_game.game_date = '2026-01-14';
    },
  ],
  [
    'a dossier focal game naming a different matchup',
    (dossier) => {
      dossier.experience.focal_game.matchup = 'LAC @ MIL';
    },
  ],
  [
    'a dossier focal game contradicting the participant minutes',
    (dossier) => {
      dossier.experience.focal_game.minutes = 12;
    },
  ],
  [
    'a dossier focal game contradicting the participant stat line',
    (dossier) => {
      dossier.experience.focal_game.stats.PTS = 41;
    },
  ],
])('rejects %s', (_name, mutate) => {
  const dossier = historicalDossier();
  mutate(dossier);
  expect(() => decodeMatchupSelection(dossier, ['PTS', 'FGA'], 2544, focalExpectation)).toThrow(
    'selection endpoint returned an invalid response',
  );
});

test('leaves current selection samples unbound to a focal game', () => {
  const raw = {
    player_id: 2544,
    h2h: {
      thin: false,
      rows: [
        {
          row_type: 'game',
          game_date: '2026-02-02',
          matchup: 'LAL vs. BOS',
          minutes: 33,
          stats: { PTS: 21 },
          deltas: { PTS: 0.06 },
        },
        {
          row_type: 'average',
          game_date: null,
          matchup: null,
          minutes: 33,
          stats: { PTS: 21 },
          deltas: { PTS: 0.06 },
        },
      ],
    },
    archetype: { thin: false, rows: [] },
  };

  expect(
    decodeMatchupSelection(raw, ['PTS'], 2544, { gameId: '0022500584', mode: 'current' }).h2h.rows,
  ).toHaveLength(2);
});

test.each([
  [
    'season defense sourced from game logs',
    (candidate) => {
      candidate.experience.sections.season_defense.source = 'player_game_logs';
    },
  ],
  [
    'schedule sourced from a defense publication',
    (candidate) => {
      candidate.experience.sections.schedule.source = 'team_matchup_publication';
    },
  ],
  [
    'participants sourced from the Event Catalog',
    (candidate) => {
      candidate.experience.sections.participants.source = 'event_catalog';
    },
  ],
  [
    'an archived Last-15 snapshot sourced from game logs',
    (candidate) => {
      candidate.experience.sections.last_15_defense = experienceSection(
        'available',
        'player_game_logs',
        'pregame',
      );
    },
  ],
  [
    'an archived injury snapshot described as completed-season context',
    (candidate) => {
      candidate.experience.sections.injuries = experienceSection(
        'available',
        'rotowire',
        'completed_season',
      );
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('accepts truthful archived pregame Last-15 and injury evidence in historical mode', () => {
  // A point-in-time snapshot was captured, so its Surfaces are delivered too.
  const candidate = historicalPayload({ pointInTime: true });
  candidate.experience.sections.last_15_defense = experienceSection(
    'available',
    'team_matchup_publication',
    'pregame',
  );
  candidate.experience.sections.injuries = experienceSection('available', 'rotowire', 'pregame');

  const { sections } = decodeMatchup(candidate).experience;
  expect(sections.last15Defense).toEqual(
    expect.objectContaining({
      status: 'available',
      source: 'team_matchup_publication',
      context: 'pregame',
    }),
  );
  expect(sections.injuries).toEqual(
    expect.objectContaining({ status: 'available', source: 'rotowire', context: 'pregame' }),
  );
});

test('keeps historical component evidence while withholding an incomplete blend', () => {
  const candidate = historicalPayload();
  candidate.players[0].scores.PTS.season = {
    components: { shot_zones: { value: 0.07, thin: true } },
    blend: null,
    missing_inputs: ['team_defense:play_types'],
  };

  expect(decodeMatchup(candidate).players[0].scores.PTS.season).toEqual({
    components: { shotZones: { value: 0.07, thin: true } },
    blend: null,
    missingInputs: ['team_defense:play_types'],
  });
});

test.each([
  [
    'a historical blend presented complete despite named missing inputs',
    (candidate) => {
      candidate.players[0].scores.PTS.season.missing_inputs = ['team_defense:play_types'];
    },
  ],
  [
    'a historical offensive window that withholds a computable blend',
    (candidate) => {
      candidate.players[0].scores.PTS.season.blend = null;
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test.each([
  [
    'a withheld historical offensive score that names no missing input',
    (candidate) => {
      candidate.players[0].scores.PTS.season = {
        components: {},
        blend: null,
        missing_inputs: [],
      };
    },
  ],
  [
    'a withheld historical defensive score that names no missing input',
    (candidate) => {
      candidate.players[0].stat_categories = ['PTS', 'FGA', 'TOV'];
      candidate.players[0].scores.TOV = {
        season: { components: {}, missing_inputs: [] },
        last_15: { components: {}, missing_inputs: ['team_defense:traditional'] },
      };
      candidate.players[0].focal_game_line.stats.TOV = 2;
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('leaves the legacy zero-component window decodable in current mode', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.players[0].scores.FGA.last_15 = { components: {}, blend: null };

  expect(decodeMatchup(candidate).players[0].scores.FGA.last15).toEqual({
    components: {},
    blend: null,
    missingInputs: [],
  });
});

test('leaves the current-mode blend contract unchanged', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.players[0].scores.PTS.season.missing_inputs = ['team_defense:play_types'];

  expect(decodeMatchup(candidate).players[0].scores.PTS.season.blend).toEqual({
    value: 0.12,
    thin: false,
  });
});

test.each([
  [
    'a defense sheet for a team outside the focal game',
    (candidate) => {
      candidate.teams[1].team_id = 99;
    },
  ],
  [
    'a defense sheet whose tricode contradicts the game header',
    (candidate) => {
      candidate.teams[0].tricode = 'BOS';
    },
  ],
  [
    'defense sheets delivered home before away',
    (candidate) => {
      candidate.teams.reverse();
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test.each([
  [
    'an available Season Surface alongside an unavailable Season defense section',
    (candidate) => {
      candidate.experience.sections.season_defense = experienceSection(
        'unavailable',
        null,
        null,
        'not_stored',
      );
    },
  ],
  [
    'an available Season defense section with no available Season Surface',
    (candidate) => {
      // The Season windows go away with their Surfaces, so only the section's
      // own claim of availability is left to reject.
      Object.values(candidate.league.surface_availability).forEach((windows) => {
        windows.season = { status: 'unavailable', unavailable_reason: 'not_stored' };
      });
      [candidate.league, ...candidate.teams].forEach((holder) => {
        Object.values(holder.defense_sheet).forEach((rows) =>
          rows.forEach((row) => {
            row.season = null;
          }),
        );
        Object.values(holder.defensive_columns).forEach((column) => {
          column.season = null;
        });
      });
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('rejects an available Last-15 Surface alongside an unavailable Last-15 section', () => {
  // Traditional keeps its delivered Last-15 window; the other Bases lose theirs.
  const candidate = historicalPayload();
  const restored = JSON.parse(JSON.stringify(payload));
  candidate.league.surface_availability.traditional.last_15 = {
    status: 'available',
    unavailable_reason: null,
  };
  [
    [candidate.league, restored.league],
    ...candidate.teams.map((team, index) => [team, restored.teams[index]]),
  ].forEach(([holder, source]) => {
    holder.defense_sheet.traditional = source.defense_sheet.traditional;
    Object.entries(holder.defensive_columns).forEach(([key, column]) => {
      column.last_15 = source.defensive_columns[key].last_15;
    });
  });

  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('keeps section independence when a window is genuinely unavailable', () => {
  const { sections } = decodeMatchup(historicalPayload()).experience;

  expect(sections.seasonDefense.status).toBe('available');
  expect(sections.last15Defense.status).toBe('unavailable');
  expect(sections.injuries.status).toBe('unavailable');
  expect(sections.participants.status).toBe('available');
});

test.each([
  [
    'a historical experience on a game that has not been played',
    (candidate) => {
      candidate.game.status = { state: 'scheduled', label: 'Scheduled' };
    },
  ],
  [
    'a historical experience on a postponed game',
    (candidate) => {
      candidate.game.status = { state: 'postponed', label: 'Postponed' };
    },
  ],
  [
    'a historical experience on a preseason game',
    (candidate) => {
      candidate.game.preseason = true;
    },
  ],
])('rejects %s', (_name, mutate) => {
  const candidate = historicalPayload();
  mutate(candidate);
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});

test('still reads the backend-declared mode rather than inferring it from a final game', () => {
  const finalCurrent = JSON.parse(JSON.stringify(payload));
  finalCurrent.game.status = { state: 'final', label: 'Final' };

  expect(decodeMatchup(finalCurrent).experience.mode).toBe('current');
});

test('rejects an impossible focal date rather than comparing it as a string', () => {
  const candidate = historicalPayload();
  focalLineOf(candidate).game_date = '2025-99-99';
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');

  const dossier = historicalDossier();
  dossier.h2h.rows[0].game_date = '2025-99-99';
  expect(() => decodeMatchupSelection(dossier, ['PTS', 'FGA'], 2544, focalExpectation)).toThrow(
    'selection endpoint returned an invalid response',
  );

  const impossibleFocal = historicalDossier();
  impossibleFocal.experience.focal_game.game_date = '2026-02-30';
  expect(() =>
    decodeMatchupSelection(impossibleFocal, ['PTS', 'FGA'], 2544, focalExpectation),
  ).toThrow('selection endpoint returned an invalid response');
});

test('accepts either team ordering in current mode', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.teams.reverse();

  expect(decodeMatchup(candidate).teams.map((team) => team.tricode)).toEqual(['BOS', 'LAL']);
});

test('still binds current-mode defense sheets to the two teams that played', () => {
  const candidate = JSON.parse(JSON.stringify(payload));
  candidate.teams[1].team_id = 99;
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');

  const swappedTricode = JSON.parse(JSON.stringify(payload));
  swappedTricode.teams[0].tricode = 'BOS';
  expect(() => decodeMatchup(swappedTricode)).toThrow('invalid response');
});

test('keeps live Player Pool categories identical to the posted markets', () => {
  const [player] = decodeMatchup(payload).players;

  expect(player.playerSource).toBe('player_pool');
  expect(player.statCategories).toEqual(player.postedMarkets);
  expect(player.focalGameLine).toBeNull();
});

test('reads the additive selection experience and its separated focal game', () => {
  const raw = {
    player_id: 2544,
    experience: {
      mode: 'historical',
      player_source: 'game_logs',
      focal_game: {
        game_id: '0022501082',
        game_date: '2026-03-29',
        matchup: 'LAC @ MIL',
        minutes: 34.5,
        stats: { PTS: 24, FGA: 18 },
      },
      samples: { context: 'pregame', excludes_focal_game: true },
      baseline: { context: 'completed_season', hindsight: true },
    },
    h2h: { thin: false, rows: [] },
    archetype: { thin: false, rows: [] },
  };

  const selection = decodeMatchupSelection(raw, ['PTS', 'FGA'], 2544);
  expect(selection.experience.mode).toBe('historical');
  expect(selection.experience.focalGame.matchup).toBe('LAC @ MIL');
  expect(selection.experience.samples).toEqual({ context: 'pregame', excludesFocalGame: true });
  expect(selection.experience.baseline).toEqual({
    context: 'completed_season',
    hindsight: true,
  });

  expect(
    decodeMatchupSelection({ ...raw, experience: undefined }, ['PTS', 'FGA'], 2544).experience,
  ).toBeNull();
  // The focal line rejects a missing governed category on both response seams.
  expect(() =>
    decodeMatchupSelection(
      {
        ...raw,
        experience: {
          ...raw.experience,
          focal_game: { ...raw.experience.focal_game, stats: { PTS: 24 } },
        },
      },
      ['PTS', 'FGA'],
      2544,
    ),
  ).toThrow('selection endpoint returned an invalid response');
  expect(() =>
    decodeMatchupSelection(
      { ...raw, experience: { ...raw.experience, baseline: { context: 'completed_season' } } },
      ['PTS', 'FGA'],
      2544,
    ),
  ).toThrow('selection endpoint returned an invalid response');

  const current = decodeMatchupSelection(
    {
      ...raw,
      experience: {
        mode: 'current',
        player_source: 'player_pool',
        focal_game: null,
        samples: { context: 'season_to_date', excludes_focal_game: false },
        baseline: { context: 'season_to_date', hindsight: false },
      },
    },
    ['PTS', 'FGA'],
    2544,
  );
  expect(current.experience.focalGame).toBeNull();
  expect(current.experience.baseline.hindsight).toBe(false);
});

// The dossier renders its separation labels from these fields, so a mislabelled
// response must fail closed rather than quietly drop a required disclosure.
test.each([
  ['a historical selection with no focal game', { focal_game: null }],
  [
    'a historical selection whose samples do not exclude the focal game',
    { samples: { context: 'pregame', excludes_focal_game: false } },
  ],
  [
    'a historical selection with a season-to-date sample context',
    { samples: { context: 'season_to_date', excludes_focal_game: true } },
  ],
  [
    'a historical selection whose baseline is not marked hindsight',
    { baseline: { context: 'completed_season', hindsight: false } },
  ],
  [
    'a historical selection with a season-to-date baseline context',
    { baseline: { context: 'season_to_date', hindsight: true } },
  ],
  ['a historical selection sourced from a Player Pool', { player_source: 'player_pool' }],
  ['a current selection that still carries a focal game', { mode: 'current' }],
])('rejects %s', (_name, override) => {
  const raw = {
    player_id: 2544,
    experience: {
      mode: 'historical',
      player_source: 'game_logs',
      focal_game: {
        game_id: '0022501082',
        game_date: '2026-03-29',
        matchup: 'LAC @ MIL',
        minutes: 34.5,
        stats: { PTS: 24, FGA: 18 },
      },
      samples: { context: 'pregame', excludes_focal_game: true },
      baseline: { context: 'completed_season', hindsight: true },
      ...override,
    },
    h2h: { thin: false, rows: [] },
    archetype: { thin: false, rows: [] },
  };
  expect(() => decodeMatchupSelection(raw, ['PTS', 'FGA'], 2544)).toThrow(
    'selection endpoint returned an invalid response',
  );
});
