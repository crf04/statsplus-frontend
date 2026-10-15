import { decodeSlateEdges, fetchSlateEdges } from './slateEdgesApi';
import { apiClient } from './config';

jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: jest.fn(() => '/api/games/slate/edges'),
}));

const reason = {
  base: 'play_types',
  slice_key: 'Transition',
  share: 0.291,
  league_average_share: 0.183,
  opponent_rank: 29,
  opponent_percent_vs_league: 18.8,
};

const best = {
  game_id: '0022501172',
  canonical_id: 1630539,
  name: 'Jaime Jaquez Jr.',
  tricode: 'MIA',
  opponent: 'WAS',
  season_scoring: 15.4,
  value: 0.0674,
  reason,
};

const payload = {
  slate_date: '2026-04-10',
  games: [
    {
      game_id: '0022501171',
      effects: [
        {
          canonical_id: 1628970,
          name: 'Miles Bridges',
          tricode: 'CHA',
          season_scoring: 17.1,
          value: -0.0823,
          thin: false,
        },
      ],
      scores: [
        { canonical_id: 1628970, value: -0.0823 },
        { canonical_id: 1642270, value: 0.012 },
      ],
    },
  ],
  spotlight: {
    best,
    toughest: { ...best, name: 'Miles Bridges', value: -0.0823, opponent: 'DET' },
  },
};

afterEach(() => jest.clearAllMocks());

test('decodes games, scores by canonical id, and both picks', () => {
  const edges = decodeSlateEdges(payload);

  expect(edges.slateDate).toBe('2026-04-10');
  expect(edges.games[0].gameId).toBe('0022501171');
  expect(edges.games[0].effects).toEqual([
    {
      canonicalId: 1628970,
      name: 'Miles Bridges',
      tricode: 'CHA',
      seasonScoring: 17.1,
      value: -0.0823,
      thin: false,
    },
  ]);
  expect(edges.games[0].scores.get(1642270)).toBe(0.012);
  expect(edges.spotlight.best).toEqual({
    gameId: '0022501172',
    canonicalId: 1630539,
    name: 'Jaime Jaquez Jr.',
    tricode: 'MIA',
    opponent: 'WAS',
    seasonScoring: 15.4,
    value: 0.0674,
    reason: {
      base: 'play_types',
      sliceKey: 'Transition',
      share: 0.291,
      leagueAverageShare: 0.183,
      opponentRank: 29,
      opponentPercentVsLeague: 18.8,
    },
  });
  expect(edges.spotlight.toughest.name).toBe('Miles Bridges');
});

test('an empty slate decodes with no games and no picks', () => {
  expect(
    decodeSlateEdges({
      slate_date: '2026-10-15',
      games: [],
      spotlight: { best: null, toughest: null },
    }),
  ).toEqual({ slateDate: '2026-10-15', games: [], spotlight: { best: null, toughest: null } });
});

test.each([
  ['a missing slate date', { ...payload, slate_date: undefined }],
  ['a missing spotlight pick', { ...payload, spotlight: { best } }],
  ['a game without scores', { ...payload, games: [{ game_id: 'g', effects: [] }] }],
  [
    'an effect without a thin flag',
    {
      ...payload,
      games: [{ ...payload.games[0], effects: [{ ...payload.games[0].effects[0], thin: 0 }] }],
    },
  ],
  [
    'a best pick that is unfavourable',
    { ...payload, spotlight: { best: { ...best, value: -0.01 }, toughest: null } },
  ],
  ['a toughest pick that is favourable', { ...payload, spotlight: { best: null, toughest: best } }],
  [
    'a pick without a reason',
    { ...payload, spotlight: { best: { ...best, reason: null }, toughest: null } },
  ],
])('refuses %s', (_label, bad) => {
  expect(() => decodeSlateEdges(bad)).toThrow(
    'The slate edges endpoint returned an invalid response.',
  );
});

test('fetches the current slate date and decodes it', async () => {
  apiClient.get.mockResolvedValue({ data: payload });

  const edges = await fetchSlateEdges();

  expect(apiClient.get).toHaveBeenCalledWith('/api/games/slate/edges', { signal: undefined });
  expect(edges.spotlight.best.name).toBe('Jaime Jaquez Jr.');
});

test('a backend without the route reads as no edges rather than an error', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 404 } });

  await expect(fetchSlateEdges()).resolves.toBeNull();
});

test('any other failure is surfaced', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 503 } });

  await expect(fetchSlateEdges()).rejects.toEqual({ response: { status: 503 } });
});
