// Raw `/games/matchup` response shared by the decoder and page tests.
export const payload = {
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
      book_lines: {},
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
