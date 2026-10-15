import { apiClient } from './config';
import { decodeSeasons, fetchSeasons, resetSeasonsCache } from './seasonsApi';

jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: jest.fn(() => '/api/games/seasons'),
}));

const payload = { seasons: ['2026-27', '2025-26'], default_season: '2025-26' };

beforeEach(() => {
  apiClient.get.mockReset();
  resetSeasonsCache();
});

test('decodes the seasons and the default season', () => {
  expect(decodeSeasons(payload)).toEqual({
    seasons: ['2026-27', '2025-26'],
    defaultSeason: '2025-26',
  });
});

test('rejects a response that is not a list of seasons', () => {
  expect(() => decodeSeasons({ seasons: 'nope', default_season: '2025-26' })).toThrow(
    'The seasons endpoint returned an invalid response.',
  );
  expect(() => decodeSeasons({ seasons: [1], default_season: '2025-26' })).toThrow();
});

test('asks once per page session and shares the answer', async () => {
  apiClient.get.mockResolvedValue({ data: payload });
  const [first, second] = await Promise.all([fetchSeasons(), fetchSeasons()]);
  await fetchSeasons();
  expect(apiClient.get).toHaveBeenCalledTimes(1);
  expect(apiClient.get).toHaveBeenCalledWith('/api/games/seasons');
  expect(second).toBe(first);
});

test('forgets a failed read so the next ask retries', async () => {
  apiClient.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: payload });
  await expect(fetchSeasons()).rejects.toThrow('offline');
  expect(await fetchSeasons()).toEqual({
    seasons: ['2026-27', '2025-26'],
    defaultSeason: '2025-26',
  });
  expect(apiClient.get).toHaveBeenCalledTimes(2);
});
