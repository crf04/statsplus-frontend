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
  pool_status: 'stale-served',
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
  ['unknown aggregate pool status', { ...payload, pool_status: 'old' }],
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
      pool_status: 'unavailable',
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

test('derives the aggregate pool status when the optional top-level field is absent', () => {
  const { pool_status: _poolStatus, ...minimumPayload } = payload;
  minimumPayload.freshness = {
    ...minimumPayload.freshness,
    pool: { status: 'fresh', retrieved_at: '2026-01-15T09:55:00Z' },
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
  ['unavailable', 'stale-served', 'stale-served', 'unavailable'],
  ['fresh', 'unavailable', 'missing', 'fresh'],
  [undefined, 'stale-served', 'fresh', 'stale-served'],
])(
  'uses aggregate %s with pool freshness %s and provider freshness %s',
  (aggregateStatus, poolFreshnessStatus, providerStatus, expected) => {
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
              status: providerStatus,
              retrieved_at: ['missing', 'unavailable'].includes(providerStatus)
                ? null
                : '2026-01-15T09:55:00Z',
            },
          },
        },
      },
    };
    if (aggregateStatus === undefined) delete candidate.pool_status;
    else candidate.pool_status = aggregateStatus;

    expect(decodeSlate(candidate).poolStatus).toBe(expected);
  },
);

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
  delete candidate.pool_status;

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
