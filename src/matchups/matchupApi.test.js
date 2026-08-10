import { decodeMatchup } from './matchupApi';

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
    },
    {
      team_id: 2,
      tricode: 'BOS',
      name: 'Boston Celtics',
      defense_sheet: { play_types: [] },
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
    expect.objectContaining({ id: 'lebron-james', postedMarkets: ['PTS', 'FGA'] }),
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
])('rejects %s at the response boundary', (_name, candidate) => {
  expect(() => decodeMatchup(candidate)).toThrow('invalid response');
});
