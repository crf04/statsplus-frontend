import { apiClient, getApiUrl } from './config';
import {
  decodeGameLogsResponse,
  fetchGameLogsData,
  getRequestErrorMessage,
  lineSourcesFor,
  postedLineFor,
} from './gameLogsApi';

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
      playerId: null,
      postedLine: null,
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

  test('reads the player id that names their headshot', () => {
    expect(decodeGameLogsResponse({ game_logs: [], player_id: 2544 }).playerId).toBe(2544);
  });

  const curryPosted = {
    game_id: '0022600012',
    game_date: '2026-10-21',
    matchup: 'GSW vs LAL',
    lines: {
      PTS: { value: 26.5, provider: 'dabble' },
      '3PM': { value: 4.5, provider: 'underdog' },
      REB: { value: '7.5', provider: 'prizepicks' },
      AST: { value: 8.5 },
    },
    provider_lines: {
      underdog: { PTS: 26.5, '3PM': 4.5 },
      dabble: { PTS: 26.5 },
      kalshi: { PTS: 27.5 },
      prizepicks: { PTS: 25.5 },
      novig: { PTS: '26.5' },
    },
    line_prices: {
      dabble: { PTS: { over: -122, under: -122 } },
      underdog: { PTS: { over: -112, under: null }, '3PM': { over: 105, under: -135 } },
    },
    book_lines: {
      PTS: {
        as_of: '2026-10-21T15:00:00Z',
        closing: false,
        books: [
          { book: 'draftkings', line: 26.5, over: -110, under: -115 },
          { book: 'hardrockbet', line: 27.5, over: null, under: null },
          { book: 'fanduel', line: null, over: -110, under: -110 },
        ],
      },
    },
  };

  test('reads every source posting a market, providers then books, keeping unknown keys', () => {
    const { postedLine } = decodeGameLogsResponse({ game_logs: [], posted_line: curryPosted });
    expect(lineSourcesFor(postedLine, 'PTS')).toEqual([
      { kind: 'provider', key: 'prizepicks', line: 25.5, over: null, under: null },
      { kind: 'provider', key: 'dabble', line: 26.5, over: -122, under: -122 },
      { kind: 'provider', key: 'kalshi', line: 27.5, over: null, under: null },
      { kind: 'provider', key: 'underdog', line: 26.5, over: -112, under: null },
      { kind: 'book', key: 'draftkings', line: 26.5, over: -110, under: -115 },
      { kind: 'book', key: 'hardrockbet', line: 27.5, over: null, under: null },
    ]);
    expect(lineSourcesFor(postedLine, 'FG3M')).toEqual([
      { kind: 'provider', key: 'underdog', line: 4.5, over: 105, under: -135 },
    ]);
    expect(lineSourcesFor(postedLine, 'REB')).toEqual([]);
  });

  test('the line defaults to the source `lines` names, and any other can be chosen', () => {
    const { postedLine } = decodeGameLogsResponse({ game_logs: [], posted_line: curryPosted });
    expect(postedLineFor(postedLine, 'PTS')).toEqual({
      kind: 'provider',
      key: 'dabble',
      line: 26.5,
      over: -122,
      under: -122,
      gameDate: '2026-10-21',
      matchup: 'GSW vs LAL',
    });
    expect(postedLineFor(postedLine, 'PTS', 'book:hardrockbet')).toEqual({
      kind: 'book',
      key: 'hardrockbet',
      line: 27.5,
      over: null,
      under: null,
      gameDate: '2026-10-21',
      matchup: 'GSW vs LAL',
    });
    expect(postedLineFor(postedLine, 'FG3M')).toMatchObject({ key: 'underdog', line: 4.5 });
    expect(postedLineFor(postedLine, 'PTS', 'book:fanduel')).toBeNull();
    expect(postedLineFor(postedLine, 'REB')).toBeNull();
    expect(postedLineFor(null, 'PTS')).toBeNull();
  });

  test('a default no source lists is still offered, first', () => {
    const { postedLine } = decodeGameLogsResponse({
      game_logs: [],
      posted_line: {
        ...curryPosted,
        lines: { PTS: { value: 27, provider: 'draftkings' } },
      },
    });
    expect(postedLineFor(postedLine, 'PTS')).toMatchObject({ key: 'draftkings', line: 27 });
    expect(lineSourcesFor(postedLine, 'PTS').map(({ key, line }) => `${key} ${line}`)).toEqual([
      'draftkings 27',
      'prizepicks 25.5',
      'dabble 26.5',
      'kalshi 27.5',
      'underdog 26.5',
      'draftkings 26.5',
      'hardrockbet 27.5',
    ]);
  });

  // A signed-out or waitlisted reader's response (crf04/statsplus#381) omits
  // `line_prices` and every book's prices, keeping each line and its source.
  test('a response without prices keeps every line and source, unpriced', () => {
    const { line_prices: _prices, ...anonymous } = curryPosted;
    anonymous.book_lines = {
      PTS: {
        as_of: '2026-10-21T15:00:00Z',
        closing: false,
        books: [
          { book: 'draftkings', line: 26.5 },
          { book: 'hardrockbet', line: 27.5 },
        ],
      },
    };
    const { postedLine } = decodeGameLogsResponse({ game_logs: [], posted_line: anonymous });
    expect(lineSourcesFor(postedLine, 'PTS')).toEqual([
      { kind: 'provider', key: 'prizepicks', line: 25.5, over: null, under: null },
      { kind: 'provider', key: 'dabble', line: 26.5, over: null, under: null },
      { kind: 'provider', key: 'kalshi', line: 27.5, over: null, under: null },
      { kind: 'provider', key: 'underdog', line: 26.5, over: null, under: null },
      { kind: 'book', key: 'draftkings', line: 26.5, over: null, under: null },
      { kind: 'book', key: 'hardrockbet', line: 27.5, over: null, under: null },
    ]);
    expect(postedLineFor(postedLine, 'PTS')).toEqual({
      kind: 'provider',
      key: 'dabble',
      line: 26.5,
      over: null,
      under: null,
      gameDate: '2026-10-21',
      matchup: 'GSW vs LAL',
    });
  });

  test('a response without sources keeps its posted line and offers no choice', () => {
    const { postedLine } = decodeGameLogsResponse({
      game_logs: [],
      posted_line: {
        game_date: '2026-10-21',
        matchup: 'LAL vs GSW',
        lines: { PTS: { value: 27.5, provider: 'prizepicks' } },
        provider_lines: 'x',
        book_lines: { PTS: { books: 'x' } },
      },
    });
    expect(postedLineFor(postedLine, 'PTS')).toEqual({
      kind: 'provider',
      key: 'prizepicks',
      line: 27.5,
      over: null,
      under: null,
      gameDate: '2026-10-21',
      matchup: 'LAL vs GSW',
    });
    expect(lineSourcesFor(postedLine, 'PTS')).toEqual([]);
  });

  test.each([undefined, null, 'x', {}, { lines: {} }, { lines: { PTS: { value: null } } }])(
    'reads posted lines of %p as none',
    (value) => {
      expect(decodeGameLogsResponse({ game_logs: [], posted_line: value }).postedLine).toBeNull();
    },
  );

  test.each([undefined, null, 0, -1, 2.5, '2544'])(
    'reads a player id of %p as unknown',
    (value) => {
      expect(decodeGameLogsResponse({ game_logs: [], player_id: value }).playerId).toBeNull();
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
