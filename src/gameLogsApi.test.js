import { apiClient, getApiUrl } from './config';
import { decodeGameLogsResponse, fetchGameLogsData, getRequestErrorMessage } from './gameLogsApi';

jest.mock('./config', () => ({
  apiClient: { get: jest.fn() },
  getApiUrl: jest.fn(() => '/api/games/game_logs'),
}));

describe('gameLogsApi', () => {
  beforeEach(() => {
    apiClient.get.mockReset();
  });

  test('opts game-log requests out of the shared client timeout', async () => {
    apiClient.get.mockResolvedValue({
      data: { game_logs: [], averages: [], season_averages: [] },
    });
    const controller = new AbortController();

    await fetchGameLogsData({ player_name: 'LeBron James' }, { signal: controller.signal });

    expect(getApiUrl).toHaveBeenCalledWith('GAME_LOGS');
    expect(apiClient.get).toHaveBeenCalledWith('/api/games/game_logs', {
      params: { player_name: 'LeBron James' },
      signal: controller.signal,
      timeout: 0,
    });
  });

  test('decodes JSON-string and object payloads once and reverses logs for display', () => {
    expect(
      decodeGameLogsResponse({
        game_logs: JSON.stringify([
          { GAME_ID: 1, WL: 'W', TOV: 3 },
          { GAME_ID: 2, WL: 'L', TOV: 2 },
        ]),
        averages: JSON.stringify([{ PTS: 20 }]),
        season_averages: [{ PTS: 21 }],
        season_game_count: 71,
        next_game: 'Boston Celtics',
      }),
    ).toEqual({
      gameLogs: [
        { GAME_ID: 2, WL: 'L', TOV: 2 },
        { GAME_ID: 1, WL: 'W', TOV: 3 },
      ],
      averages: [{ PTS: 20 }, { PTS: 21 }],
      seasonGameCount: 71,
      nextGame: 'Boston Celtics',
    });
  });

  test('keeps a zero season game count', () => {
    expect(decodeGameLogsResponse({ game_logs: [], season_game_count: 0 }).seasonGameCount).toBe(0);
  });

  // An older backend, a cached response, or a malformed value must not invent a
  // season size, so anything but a non-negative integer reads as unknown.
  test.each([undefined, null, -1, 2.5, '71', Number.NaN])(
    'reads a season game count of %p as unknown',
    (value) => {
      expect(
        decodeGameLogsResponse({ game_logs: [], season_game_count: value }).seasonGameCount,
      ).toBeNull();
    },
  );

  test('returns a useful error for malformed game logs', () => {
    expect(() => decodeGameLogsResponse({ game_logs: '{not-json}' })).toThrow(
      /invalid game logs response/i,
    );
  });

  test('reads the standard backend error shape', () => {
    expect(
      getRequestErrorMessage({
        response: { data: { error: { code: 'provider_unavailable', message: 'Try later.' } } },
      }),
    ).toBe('Try later.');
  });

  test('turns transport timeouts into a useful retry message', () => {
    expect(
      getRequestErrorMessage({
        code: 'ECONNABORTED',
        message: 'timeout of 15000ms exceeded',
      }),
    ).toBe('The request took too long. Please try again.');
  });
});
