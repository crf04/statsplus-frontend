// The production Slate of 2026-10-20 after every game tipped (crf04/statsplus#280): each game reads
// closing, so the pool has no status and its providers are closing or missing.
export const closingPoolSlatePayload = {
  fallback: null,
  freshness: {
    pool: {
      observed_at: '2026-10-16T04:05:12.213388+00:00',
      providers: {
        dabble: {
          retrieved_at: '2026-10-16T04:05:12.213388+00:00',
          status: 'closing',
        },
        kalshi: {
          retrieved_at: null,
          status: 'missing',
        },
        novig: {
          retrieved_at: '2026-10-19T10:22:27.107491+00:00',
          status: 'closing',
        },
        polymarket: {
          retrieved_at: '2026-10-20T18:54:24.833611+00:00',
          status: 'closing',
        },
        prizepicks: {
          retrieved_at: null,
          status: 'missing',
        },
        underdog: {
          retrieved_at: '2026-10-20T18:54:26.472329+00:00',
          status: 'closing',
        },
      },
      retrieved_at: '2026-10-16T04:05:12.213388+00:00',
      state: 'closing',
    },
    schedule: {
      retrieved_at: '2026-10-20T09:04:40.297816+00:00',
      status: 'fresh',
    },
  },
  games: [
    {
      away_team: {
        name: 'Boston Celtics',
        targetable_player_count: 9,
        team_id: 1610612738,
        tricode: 'BOS',
      },
      classification: null,
      game_id: '0022600001',
      home_team: {
        name: 'Detroit Pistons',
        targetable_player_count: 10,
        team_id: 1610612765,
        tricode: 'DET',
      },
      injury_counts: {
        Available: 0,
        Doubtful: 0,
        Out: 5,
        Probable: 0,
        Questionable: 0,
      },
      preseason: false,
      projection_state: {
        observed_at: '2026-10-16T04:05:12.213388+00:00',
        state: 'closing',
      },
      scheduled_at: '2026-10-20T19:00:00+00:00',
      status: {
        label: 'Scheduled',
        state: 'scheduled',
      },
    },
    {
      away_team: {
        name: 'Philadelphia 76ers',
        targetable_player_count: 7,
        team_id: 1610612755,
        tricode: 'PHI',
      },
      classification: null,
      game_id: '0022600002',
      home_team: {
        name: 'New York Knicks',
        targetable_player_count: 8,
        team_id: 1610612752,
        tricode: 'NYK',
      },
      injury_counts: {
        Available: 2,
        Doubtful: 0,
        Out: 4,
        Probable: 0,
        Questionable: 0,
      },
      preseason: false,
      projection_state: {
        observed_at: '2026-10-19T10:33:25.097035+00:00',
        state: 'closing',
      },
      scheduled_at: '2026-10-20T23:00:00+00:00',
      status: {
        label: 'Scheduled',
        state: 'scheduled',
      },
    },
    {
      away_team: {
        name: 'Oklahoma City Thunder',
        targetable_player_count: 9,
        team_id: 1610612760,
        tricode: 'OKC',
      },
      classification: null,
      game_id: '0022600003',
      home_team: {
        name: 'San Antonio Spurs',
        targetable_player_count: 9,
        team_id: 1610612759,
        tricode: 'SAS',
      },
      injury_counts: {
        Available: 0,
        Doubtful: 0,
        Out: 5,
        Probable: 0,
        Questionable: 0,
      },
      preseason: false,
      projection_state: {
        observed_at: '2026-10-19T11:06:10.106867+00:00',
        state: 'closing',
      },
      scheduled_at: '2026-10-21T01:30:00+00:00',
      status: {
        label: 'Scheduled',
        state: 'scheduled',
      },
    },
  ],
  next_game_date: '2026-10-21',
  previous_game_date: '2026-04-12',
  provenance: {
    generation: [],
    sources: {
      injuries: {
        retrieved_at: '2026-10-20T18:31:19.664619+00:00',
        status: 'fresh',
      },
      pool: {
        retrieved_at: '2026-10-16T04:05:12.213388+00:00',
        status: null,
      },
      schedule: {
        retrieved_at: '2026-10-20T09:04:40.297816+00:00',
        status: 'fresh',
      },
    },
  },
  slate_date: '2026-10-20',
};
