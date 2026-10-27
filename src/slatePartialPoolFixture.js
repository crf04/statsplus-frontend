// The production Slate of 2026-10-20 (crf04/statsplus#278): BOS @ DET tipped while the catalog
// still had it scheduled, so its pool went missing beside two live games and the pool read partial.
export const partialPoolSlatePayload = {
  fallback: null,
  freshness: {
    pool: {
      observed_at: '2026-10-20T20:43:59.528148+00:00',
      providers: {
        dabble: {
          retrieved_at: '2026-10-20T20:43:59.528148+00:00',
          status: 'fresh',
        },
        kalshi: {
          retrieved_at: '2026-10-20T20:43:59.536630+00:00',
          status: 'fresh',
        },
        novig: {
          retrieved_at: '2026-10-20T20:43:59.536966+00:00',
          status: 'fresh',
        },
        polymarket: {
          retrieved_at: '2026-10-20T20:43:59.958001+00:00',
          status: 'fresh',
        },
        underdog: {
          retrieved_at: '2026-10-20T20:44:01.530564+00:00',
          status: 'fresh',
        },
      },
      retrieved_at: '2026-10-20T20:43:59.528148+00:00',
      state: 'live',
      status: 'partial',
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
        targetable_player_count: 0,
        team_id: 1610612738,
        tricode: 'BOS',
      },
      classification: null,
      game_id: '0022600001',
      home_team: {
        name: 'Detroit Pistons',
        targetable_player_count: 0,
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
        observed_at: null,
        state: 'missing',
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
        Available: 0,
        Doubtful: 0,
        Out: 3,
        Probable: 0,
        Questionable: 3,
      },
      preseason: false,
      projection_state: {
        observed_at: '2026-10-20T20:43:59.528148+00:00',
        state: 'live',
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
        observed_at: '2026-10-20T20:43:59.528148+00:00',
        state: 'live',
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
        retrieved_at: '2026-10-20T20:43:59.528148+00:00',
        status: 'partial',
      },
      schedule: {
        retrieved_at: '2026-10-20T09:04:40.297816+00:00',
        status: 'fresh',
      },
    },
  },
  slate_date: '2026-10-20',
};
