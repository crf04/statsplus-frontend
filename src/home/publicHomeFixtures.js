// The anonymous reads behind the public home page (crf04/statsplus#211), as the
// API serves them, for tests that render the page whole. `homeGet` stands in
// for `apiClient.get`: any other route, the Targets ones included, is a test
// failure rather than an empty answer, so a request that should not be sent
// shows up as a rejection the test can assert on.
const game = {
  game_id: 'g1',
  away_team: { team_id: 1, tricode: 'MIA', name: 'Miami Heat', targetable_player_count: 5 },
  home_team: { team_id: 2, tricode: 'WAS', name: 'Washington Wizards', targetable_player_count: 4 },
  scheduled_at: '2026-04-10T23:00:00Z',
  status: { state: 'scheduled', label: 'Scheduled' },
  classification: null,
  preseason: false,
};

const slate = {
  slate_date: '2026-04-10',
  previous_game_date: null,
  next_game_date: null,
  freshness: {
    schedule: { status: 'fresh', retrieved_at: '2026-04-10T10:00:00Z' },
    pool: { status: 'fresh', retrieved_at: '2026-04-10T10:00:00Z', providers: {} },
  },
  games: [game],
};

const effect = (id, name, tricode, value) => ({
  canonical_id: id,
  name,
  tricode,
  season_scoring: 12,
  value,
  thin: false,
});

const edges = {
  slate_date: '2026-04-10',
  games: [
    {
      game_id: 'g1',
      effects: [
        effect(1, 'Kel’el Ware', 'MIA', 0.11),
        effect(2, 'Wendell Carter Jr.', 'WAS', -0.08),
      ],
      scores: [],
    },
  ],
  spotlight: {
    best: {
      game_id: 'g1',
      canonical_id: 3,
      name: 'Jaime Jaquez Jr.',
      tricode: 'MIA',
      opponent: 'WAS',
      season_scoring: 15.4,
      value: 0.0674,
      reason: {
        base: 'play_types',
        slice_key: 'Transition',
        share: 0.291,
        league_average_share: 0.183,
        opponent_rank: 29,
        opponent_percent_vs_league: 18.8,
      },
    },
    toughest: null,
  },
};

const ladder = {
  rungs: [
    { id: 'start', points: 22.4, games: 3, series: [18, 25, 24.2] },
    { id: 'narrow', points: 24.1, games: 2, series: [27, 22] },
    { id: 'stack', points: 31, games: 1, series: [31] },
  ],
};

const bodies = {
  '/api/games/slate': slate,
  '/api/games/slate/edges': edges,
  '/api/games/ladder': ladder,
};

export const homeGet = (url) => {
  const path = new URL(url, 'http://localhost').pathname;
  return path in bodies
    ? Promise.resolve({ data: bodies[path] })
    : Promise.reject(new Error(`Unexpected request: ${path}`));
};
