import { decodeSlate, fetchSlate } from './slateApi';
import { apiClient, getApiUrl } from './config';

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
    poolStatus: 'stale-served',
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
  [
    'frontend-derived pool freshness status',
    {
      ...payload,
      freshness: {
        ...payload.freshness,
        pool: { status: 'partial', retrieved_at: null, providers: {} },
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
      poolStatus: 'unavailable',
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

  expect(decodeSlate(minimumPayload)).toEqual(
    expect.objectContaining({
      poolStatus: 'fresh',
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

  expect(decodeSlate(candidate).poolStatus).toBe(expected);
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
      poolStatus: 'stale-served',
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
  expect(decodeSlate(candidate).poolStatus).toBe(expected);
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
      poolStatus: 'partial',
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
