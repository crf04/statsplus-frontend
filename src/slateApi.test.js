import { decodeSlate, fetchSlate } from './slateApi';
import { apiClient, getApiUrl } from './config';
import { closingPoolSlatePayload } from './slateClosingPoolFixture';
import { partialPoolSlatePayload } from './slatePartialPoolFixture';

jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: jest.fn(() => '/api/games/slate'),
}));

const payload = {
  slate_date: '2026-01-15',
  freshness: {
    schedule: { retrieved_at: '2026-01-15T10:00:00Z', status: 'fresh' },
    pool: {
      status: 'stale-served',
      retrieved_at: '2026-01-15T09:55:00Z',
      providers: {
        prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T09:55:00Z' },
        underdog: { status: 'missing', retrieved_at: null },
      },
    },
  },
  games: [
    {
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
      status: { state: 'scheduled', label: '7:30 PM ET' },
      classification: 'NBA Paris Game',
      preseason: false,
    },
  ],
};

test('decodes the complete slate freshness boundary and team counts', () => {
  expect(decodeSlate(payload)).toEqual({
    slateDate: '2026-01-15',
    previousGameDate: null,
    nextGameDate: null,
    fallback: null,
    freshness: {
      schedule: { retrievedAt: '2026-01-15T10:00:00.000Z', status: 'fresh' },
      pool: {
        status: 'stale-served',
        retrievedAt: '2026-01-15T09:55:00.000Z',
        providers: [
          {
            name: 'prizepicks',
            status: 'fresh',
            retrievedAt: '2026-01-15T09:55:00.000Z',
          },
          { name: 'underdog', status: 'missing', retrievedAt: null },
        ],
      },
    },
    games: [
      expect.objectContaining({
        gameId: '0022500584',
        scheduledAt: '2026-01-16T00:30:00.000Z',
        away: expect.objectContaining({ targetablePlayerCount: 5 }),
        home: expect.objectContaining({ targetablePlayerCount: 4 }),
      }),
    ],
  });
});

test.each([
  [
    'missing freshness surface',
    { ...payload, freshness: { schedule: payload.freshness.schedule } },
  ],
  [
    'unknown schedule status',
    {
      ...payload,
      freshness: {
        ...payload.freshness,
        schedule: { ...payload.freshness.schedule, status: 'old' },
      },
    },
  ],
  [
    'invalid provider retrieval time',
    {
      ...payload,
      freshness: {
        ...payload.freshness,
        pool: {
          ...payload.freshness.pool,
          providers: {
            prizepicks: { status: 'fresh', retrieved_at: 'not-a-date' },
          },
        },
      },
    },
  ],
  ...['text', 7, null].map((schedule) => [
    `primitive schedule surface ${String(schedule)}`,
    { ...payload, freshness: { ...payload.freshness, schedule } },
  ]),
  ...['text', 7, null].map((pool) => [
    `primitive pool surface ${String(pool)}`,
    { ...payload, freshness: { ...payload.freshness, pool } },
  ]),
  ['invalid calendar slate date', { ...payload, slate_date: '2026-02-30' }],
])('rejects a %s', (_label, malformedPayload) => {
  expect(() => decodeSlate(malformedPayload)).toThrow(
    'The slate endpoint returned an invalid response.',
  );
});

test('decodes the closing slate once every game has tipped, with each game and its counts', () => {
  const slate = decodeSlate(closingPoolSlatePayload);

  expect(slate.freshness.pool).toEqual({
    status: 'closing',
    retrievedAt: '2026-10-16T04:05:12.213Z',
    providers: [
      { name: 'dabble', status: 'closing', retrievedAt: '2026-10-16T04:05:12.213Z' },
      { name: 'kalshi', status: 'missing', retrievedAt: null },
      { name: 'novig', status: 'closing', retrievedAt: '2026-10-19T10:22:27.107Z' },
      { name: 'polymarket', status: 'closing', retrievedAt: '2026-10-20T18:54:24.833Z' },
      { name: 'prizepicks', status: 'missing', retrievedAt: null },
      { name: 'underdog', status: 'closing', retrievedAt: '2026-10-20T18:54:26.472Z' },
    ],
  });
  expect(
    slate.games.map((game) => [
      `${game.away.tricode} @ ${game.home.tricode}`,
      game.away.targetablePlayerCount,
      game.home.targetablePlayerCount,
    ]),
  ).toEqual([
    ['BOS @ DET', 9, 10],
    ['PHI @ NYK', 7, 8],
    ['OKC @ SAS', 9, 9],
  ]);
});

test('decodes a pool whose providers are closing, live and missing as partial', () => {
  const slate = decodeSlate({
    ...closingPoolSlatePayload,
    freshness: {
      ...closingPoolSlatePayload.freshness,
      pool: {
        state: 'live',
        retrieved_at: '2026-10-20T22:40:00Z',
        providers: {
          dabble: { status: 'closing', retrieved_at: '2026-10-20T18:50:00Z' },
          underdog: { status: 'fresh', retrieved_at: '2026-10-20T22:40:00Z' },
          kalshi: { status: 'missing', retrieved_at: null },
        },
      },
    },
  });

  expect(slate.freshness.pool).toEqual(
    expect.objectContaining({ status: 'partial', retrievedAt: '2026-10-20T22:40:00.000Z' }),
  );
});

// Every pool and provider status crf04/statsplus-backend can emit (app/services/projection_archive.py,
// app/services/player_pool.py).
test.each([
  ['pool', 'fresh', '2026-10-20T18:00:00Z'],
  ['pool', 'stale-served', '2026-10-20T18:00:00Z'],
  ['pool', 'partial', null],
  ['pool', 'unavailable', null],
  ['provider', 'fresh', '2026-10-20T18:00:00Z'],
  ['provider', 'stale-served', '2026-10-20T18:00:00Z'],
  ['provider', 'missing', null],
  ['provider', 'closing', '2026-10-20T18:00:00Z'],
])('decodes a backend %s status of %s', (level, status, retrievedAt) => {
  const surface = { status, retrieved_at: retrievedAt };
  const pool =
    level === 'pool'
      ? { ...surface, providers: {} }
      : { retrieved_at: retrievedAt, providers: { underdog: surface } };

  expect(
    decodeSlate({ ...payload, freshness: { ...payload.freshness, pool } }).freshness.pool.status,
  ).toBe(status);
});

test('decodes a partial pool beside a game whose pool is missing', () => {
  const slate = decodeSlate(partialPoolSlatePayload);

  expect(slate.freshness.pool).toEqual(
    expect.objectContaining({ status: 'partial', retrievedAt: '2026-10-20T20:43:59.528Z' }),
  );
  expect(
    slate.games.map((game) => [
      `${game.away.tricode} @ ${game.home.tricode}`,
      game.away.targetablePlayerCount,
      game.home.targetablePlayerCount,
    ]),
  ).toEqual([
    ['BOS @ DET', 0, 0],
    ['PHI @ NYK', 7, 8],
    ['OKC @ SAS', 9, 9],
  ]);
});

test('accepts schedule staleness and an unavailable aggregate pool from the backend contract', () => {
  expect(
    decodeSlate({
      ...payload,
      freshness: {
        schedule: { status: 'stale', retrieved_at: '2026-01-13T10:00:00Z' },
        pool: { status: 'unavailable', retrieved_at: null, providers: {} },
      },
    }),
  ).toEqual(
    expect.objectContaining({
      freshness: {
        schedule: { status: 'stale', retrievedAt: '2026-01-13T10:00:00.000Z' },
        pool: { status: 'unavailable', retrievedAt: null, providers: [] },
      },
    }),
  );
});

test('uses the normative nested aggregate pool status', () => {
  const minimumPayload = {
    ...payload,
    // A legacy, non-contract field cannot override the normative nested surface.
    pool_status: 'unavailable',
    freshness: {
      ...payload.freshness,
      pool: { status: 'fresh', retrieved_at: '2026-01-15T09:55:00Z' },
    },
  };

  const decoded = decodeSlate(minimumPayload);
  expect(decoded).not.toHaveProperty('poolStatus');
  expect(decoded).toEqual(
    expect.objectContaining({
      freshness: expect.objectContaining({
        pool: expect.objectContaining({ status: 'fresh', providers: [] }),
      }),
    }),
  );
});

test.each([
  ['stale-served', 'stale-served'],
  ['unavailable', 'unavailable'],
  ['fresh', 'fresh'],
])('uses nested aggregate pool freshness %s', (poolFreshnessStatus, expected) => {
  const candidate = {
    ...payload,
    freshness: {
      ...payload.freshness,
      pool: {
        status: poolFreshnessStatus,
        retrieved_at: ['missing', 'unavailable'].includes(poolFreshnessStatus)
          ? null
          : '2026-01-15T09:55:00Z',
        providers: {
          prizepicks: {
            status: poolFreshnessStatus === 'unavailable' ? 'missing' : poolFreshnessStatus,
            retrieved_at: ['missing', 'unavailable'].includes(poolFreshnessStatus)
              ? null
              : '2026-01-15T09:55:00Z',
          },
        },
      },
    },
  };

  expect(decodeSlate(candidate).freshness.pool.status).toBe(expected);
});

test('derives missing pool freshness status from provider evidence', () => {
  const candidate = {
    ...payload,
    freshness: {
      ...payload.freshness,
      pool: {
        retrieved_at: null,
        providers: {
          prizepicks: {
            status: 'stale-served',
            retrieved_at: '2026-01-15T09:55:00Z',
          },
        },
      },
    },
  };
  expect(decodeSlate(candidate)).toEqual(
    expect.objectContaining({
      freshness: expect.objectContaining({
        pool: expect.objectContaining({
          status: 'stale-served',
          retrievedAt: '2026-01-15T09:55:00.000Z',
        }),
      }),
    }),
  );
});

test.each([
  [['fresh', 'missing'], 'partial'],
  [['fresh', 'stale-served'], 'partial'],
  [['unavailable'], 'unavailable'],
])('preserves provider-aware pool status %s from providers', (statuses, expected) => {
  const candidate = {
    ...payload,
    freshness: {
      ...payload.freshness,
      pool: {
        retrieved_at: null,
        providers: Object.fromEntries(
          statuses.map((status, index) => [
            `provider-${index}`,
            {
              status,
              retrieved_at: ['missing', 'unavailable'].includes(status)
                ? null
                : '2026-01-15T09:55:00Z',
            },
          ]),
        ),
      },
    },
  };
  expect(decodeSlate(candidate).freshness.pool.status).toBe(expected);
});

test('accepts provider freshness without a pool-level retrieved_at', () => {
  const candidate = {
    ...payload,
    freshness: {
      ...payload.freshness,
      pool: {
        providers: {
          prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T09:55:00Z' },
          underdog: { status: 'missing', retrieved_at: null },
        },
      },
    },
  };
  expect(decodeSlate(candidate)).toEqual(
    expect.objectContaining({
      freshness: expect.objectContaining({
        pool: expect.objectContaining({ status: 'partial' }),
      }),
    }),
  );
});

test.each([
  [
    {
      prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T11:50:00Z' },
      underdog: { status: 'fresh', retrieved_at: '2026-01-15T11:30:00Z' },
    },
  ],
  [
    {
      underdog: { status: 'fresh', retrieved_at: '2026-01-15T11:30:00Z' },
      prizepicks: { status: 'fresh', retrieved_at: '2026-01-15T11:50:00Z' },
    },
  ],
])('uses the oldest provider timestamp independent of key order', (providers) => {
  const candidate = {
    ...payload,
    freshness: { ...payload.freshness, pool: { providers } },
  };
  expect(decodeSlate(candidate).freshness.pool).toEqual(
    expect.objectContaining({
      status: 'fresh',
      retrievedAt: '2026-01-15T11:30:00.000Z',
    }),
  );
});

test.each([
  ['2026-01-14T06:00:00Z', 'fresh'],
  ['2026-01-14T05:59:59Z', 'stale'],
])('derives missing schedule status from its 30h threshold at %s', (retrievedAt, expected) => {
  jest.useFakeTimers().setSystemTime(new Date('2026-01-15T12:00:00Z'));
  const candidate = {
    ...payload,
    freshness: {
      ...payload.freshness,
      schedule: { retrieved_at: retrievedAt },
    },
  };

  expect(decodeSlate(candidate).freshness.schedule.status).toBe(expected);
  jest.useRealTimers();
});

test('validates optional provider freshness when providers are present', () => {
  expect(() =>
    decodeSlate({
      ...payload,
      freshness: {
        ...payload.freshness,
        pool: { ...payload.freshness.pool, providers: [] },
      },
    }),
  ).toThrow('The slate endpoint returned an invalid response.');
});

test('rejects malformed slate payloads rather than inventing an empty slate', () => {
  expect(() => decodeSlate({ slate_date: '2026-01-15' })).toThrow(
    'The slate endpoint returned an invalid response.',
  );
});

test('fetches a dated slate through the endpoint catalog and bearer transport', async () => {
  apiClient.get.mockResolvedValue({ data: payload });

  await expect(fetchSlate('2026-01-15')).resolves.toEqual(decodeSlate(payload));
  expect(apiClient.get).toHaveBeenCalledWith(getApiUrl('SLATE'), {
    params: { date: '2026-01-15' },
    signal: undefined,
  });
});

test('reads the game-day neighbours and treats absent or null ones as none', () => {
  const both = decodeSlate({
    ...payload,
    previous_game_date: '2026-01-14',
    next_game_date: '2026-01-20',
  });
  expect([both.previousGameDate, both.nextGameDate]).toEqual(['2026-01-14', '2026-01-20']);
  const onlyNext = decodeSlate({
    ...payload,
    previous_game_date: null,
    next_game_date: '2026-01-20',
  });
  expect([onlyNext.previousGameDate, onlyNext.nextGameDate]).toEqual([null, '2026-01-20']);
  const older = decodeSlate(payload);
  expect([older.previousGameDate, older.nextGameDate]).toEqual([null, null]);
});

test('reads the fallback marker, and a backend that omits it reads as none', () => {
  expect(decodeSlate({ ...payload, fallback: 'previous_game_day' }).fallback).toBe(
    'previous_game_day',
  );
  expect(decodeSlate({ ...payload, fallback: 'next_game_day' }).fallback).toBe('next_game_day');
  expect(decodeSlate({ ...payload, fallback: null }).fallback).toBeNull();
  expect(decodeSlate(payload).fallback).toBeNull();
  expect(() => decodeSlate({ ...payload, fallback: 'tomorrow' })).toThrow(
    'The slate endpoint returned an invalid response.',
  );
});

test('sends the fallback option as the fallback parameter and nothing otherwise', async () => {
  apiClient.get.mockResolvedValue({ data: payload });

  await fetchSlate(undefined, { fallback: 'previous_game_day' });
  expect(apiClient.get).toHaveBeenLastCalledWith(getApiUrl('SLATE'), {
    params: { fallback: 'previous_game_day' },
    signal: undefined,
  });

  await fetchSlate();
  expect(apiClient.get).toHaveBeenLastCalledWith(getApiUrl('SLATE'), {
    params: {},
    signal: undefined,
  });
});
