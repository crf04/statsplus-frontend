import { decodeSlate, fetchSlate } from './slateApi';
import { apiClient, getApiUrl } from './config';

jest.mock('./utils/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const payload = {
  slate_date: '2026-01-15',
  freshness: {
    schedule: { retrieved_at: '2026-01-15T10:00:00Z', status: 'fresh' },
    pool: { status: 'unavailable', retrieved_at: null, providers: {} },
  },
  pool_status: 'unavailable',
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
      targetable_counts: { away: 5, home: 4 },
    },
  ],
};

test('decodes the slate boundary including freshness and targetable counts', () => {
  expect(decodeSlate(payload)).toEqual({
    slateDate: '2026-01-15',
    freshness: payload.freshness,
    poolStatus: 'unavailable',
    games: [
      expect.objectContaining({
        gameId: '0022500584',
        scheduledAt: '2026-01-16T00:30:00.000Z',
        targetableCounts: { away: 5, home: 4 },
      }),
    ],
  });
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
