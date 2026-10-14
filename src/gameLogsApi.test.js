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

  test('bounds a game-log request at 35 s, just past the backend 30 s statement_timeout', async () => {
    apiClient.get.mockResolvedValue({
      data: { game_logs: [], averages: [], season_averages: [] },
    });
    const controller = new AbortController();

    await fetchGameLogsData({ player_name: 'LeBron James' }, { signal: controller.signal });

    expect(getApiUrl).toHaveBeenCalledWith('GAME_LOGS');
    expect(apiClient.get).toHaveBeenCalledWith('/api/games/game_logs', {
      params: { player_name: 'LeBron James' },
      signal: controller.signal,
      timeout: 35000,
    });
  });

  test('does not retry a rate_limited game-logs request, even after Retry-After', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    try {
      apiClient.get.mockRejectedValue({
        response: {
          status: 429,
          headers: { 'retry-after': '3' },
          data: { error: { code: 'rate_limited', message: 'Slow down.' } },
        },
      });

      await expect(fetchGameLogsData({ player_name: 'LeBron James' })).rejects.toMatchObject({
        response: { status: 429 },
      });
      await jest.advanceTimersByTimeAsync(10000);

      expect(apiClient.get).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
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

  test('ends a server failure message with the first eight characters of its request id', () => {
    expect(
      getRequestErrorMessage({
        response: {
          status: 500,
          headers: { 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' },
          data: { error: { code: 'operation_failed', message: 'Failed to backtest the target.' } },
        },
      }),
    ).toBe('Failed to backtest the target. (ref 77070cec)');
  });

  test('leaves a refusal, a response without a request id, and a timeout unchanged', () => {
    expect(
      getRequestErrorMessage({
        response: {
          status: 400,
          headers: { 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' },
          data: { error: { code: 'invalid_input', message: 'Choose an opponent.' } },
        },
      }),
    ).toBe('Choose an opponent.');
    expect(
      getRequestErrorMessage({
        response: {
          status: 500,
          headers: {},
          data: { error: { code: 'operation_failed', message: 'Failed to backtest the target.' } },
        },
      }),
    ).toBe('Failed to backtest the target.');
    expect(
      getRequestErrorMessage({
        code: 'ECONNABORTED',
        message: 'timeout of 15000ms exceeded',
      }),
    ).toBe('The request took too long. Please try again.');
  });

  // crf04/statsplus#157 contract: 429, Retry-After, and the backend's own sentence.
  const rateLimitedResponse = (status = 429) => ({
    response: {
      status,
      headers: { 'retry-after': '3', 'x-request-id': '77070cec-3f5e-4b7a-9d0e-5a1c2b3d4e5f' },
      data: {
        error: {
          code: 'rate_limited',
          message: 'Too many requests. Try again in 3 seconds.',
        },
      },
    },
  });

  test('shows the backend message for rate_limited, without a request reference', () => {
    expect(getRequestErrorMessage(rateLimitedResponse(), 'Unable to load game logs.')).toBe(
      'Too many requests. Try again in 3 seconds.',
    );
  });

  test('says to slow down when a 429 arrives without the backend body', () => {
    expect(
      getRequestErrorMessage(
        { message: 'Request failed with status code 429', response: { status: 429, data: '' } },
        'Unable to load game logs.',
      ),
    ).toBe('Too many requests. Try again in a few seconds.');
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
