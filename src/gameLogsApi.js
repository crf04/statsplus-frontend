import { apiClient, getApiUrl } from './config';
import { GAME_LOGS_TIMEOUT } from './apiSettings';
import { seasonRefusalOr, servingSeasonDecoders } from './servingSeason';

const parseJsonValue = (value, fallback, fieldName) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    const parseError = new Error(`Invalid ${fieldName} response from the API.`);
    parseError.cause = error;
    throw parseError;
  }
};

const firstRecord = (value) => {
  if (Array.isArray(value)) return value[0] || {};
  if (value && typeof value === 'object') return value;
  return {};
};

// How many games the unfiltered season holds (crf04/statsplus#88). An older
// backend or a malformed value must not invent a season size, so anything but a
// non-negative integer is unknown.
const seasonGameCount = (value) => (Number.isInteger(value) && value >= 0 ? value : null);

// The player's NBA person id, which names their headshot; unknown without one.
const playerId = (value) => (Number.isInteger(value) && value > 0 ? value : null);

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const price = (value) => (Number.isInteger(value) ? value : null);

/*
 * Every provider and book posting one market for his next game
 * (crf04/statsplus#274), as LineSource records:
 * { kind: 'provider' | 'book', key, line, over, under }, prices American or
 * null. Providers come first, PrizePicks then alphabetical as the backend
 * breaks a tie, then books in the order they are served. A key the app does
 * not know is kept; a posting without a numeric line is dropped.
 */
const lineSources = (value, market) => {
  const providers = Object.entries(isRecord(value.provider_lines) ? value.provider_lines : {})
    .filter(([, markets]) => Number.isFinite(markets?.[market]))
    .sort(([a], [b]) => (b === 'prizepicks') - (a === 'prizepicks') || (a < b ? -1 : 1))
    .map(([key, markets]) => ({
      kind: 'provider',
      key,
      line: markets[market],
      over: price(value.line_prices?.[key]?.[market]?.over),
      under: price(value.line_prices?.[key]?.[market]?.under),
    }));
  const books = value.book_lines?.[market]?.books;
  return [
    ...providers,
    ...(Array.isArray(books) ? books : [])
      .filter((book) => typeof book?.book === 'string' && book.book && Number.isFinite(book.line))
      .map((book) => ({
        kind: 'book',
        key: book.book,
        line: book.line,
        over: price(book.over),
        under: price(book.under),
      })),
  ];
};

/*
 * The player's posted lines for his next game (crf04/statsplus#238), or null
 * when none is posted. Each market holds the source `lines` names, which the
 * line defaults to, and every source a user can choose instead; an older
 * response with no sources leaves only the default. A market whose value is
 * not a number is dropped rather than drawn.
 */
const postedLine = (value) => {
  if (!isRecord(value) || !isRecord(value.lines)) return null;
  const markets = Object.fromEntries(
    Object.entries(value.lines)
      .filter(
        ([, line]) =>
          Number.isFinite(line?.value) && typeof line.provider === 'string' && line.provider,
      )
      .map(([market, { value: line, provider }]) => {
        const sources = lineSources(value, market);
        const named = sources.find((source) => source.key === provider && source.line === line);
        const fallback = { kind: 'provider', key: provider, line, over: null, under: null };
        return [
          market,
          {
            default: named ?? fallback,
            sources: named || sources.length === 0 ? sources : [fallback, ...sources],
          },
        ];
      }),
  );
  if (Object.keys(markets).length === 0) return null;
  return {
    gameDate: typeof value.game_date === 'string' ? value.game_date : null,
    matchup: typeof value.matchup === 'string' ? value.matchup : null,
    markets,
  };
};

// Line Types are market keys except FG3M, whose market is spelled 3PM.
const MARKET_FOR_LINE_TYPE = { FG3M: '3PM' };

/** Names one LineSource among a market's sources. */
export const lineSourceId = (source) => `${source.kind}:${source.key}`;

/** Every source a user can choose for one Line Type; empty when none is listed. */
export const lineSourcesFor = (posted, lineType) =>
  posted?.markets?.[MARKET_FOR_LINE_TYPE[lineType] || lineType]?.sources ?? [];

/**
 * The posted line one source draws for one Line Type, with its game: the
 * source `sourceId` names, or the default when none is named. Null when that
 * market or source is not posted.
 */
export const postedLineFor = (posted, lineType, sourceId) => {
  const market = posted?.markets?.[MARKET_FOR_LINE_TYPE[lineType] || lineType];
  if (!market) return null;
  const source =
    sourceId === undefined
      ? market.default
      : [market.default, ...market.sources].find(
          (candidate) => lineSourceId(candidate) === sourceId,
        );
  return source ? { ...source, gameDate: posted.gameDate, matchup: posted.matchup } : null;
};

const { decodeSeasonContext } = servingSeasonDecoders(
  () => new Error('The game logs API returned an invalid season context.'),
);

/** Decode the backend's JSON-string-or-object response once at the API seam. */
export const decodeGameLogsResponse = (payload = {}) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('The game logs API returned an invalid response.');
  }

  const gameLogs = parseJsonValue(payload.game_logs, [], 'game logs');
  if (!Array.isArray(gameLogs)) {
    throw new Error('The game logs API returned an invalid game logs list.');
  }

  const averages = parseJsonValue(payload.averages, [], 'averages');
  const seasonAverages = parseJsonValue(payload.season_averages, [], 'season averages');

  return {
    gameLogs: [...gameLogs].reverse(),
    averages: [firstRecord(averages), firstRecord(seasonAverages)],
    seasonGameCount: seasonGameCount(payload.season_game_count),
    nextGame: payload.next_game || null,
    playerId: playerId(payload.player_id),
    postedLine: postedLine(payload.posted_line),
    seasonContext: decodeSeasonContext(payload.season_context),
  };
};

/** Fetch and decode game logs. The caller owns state; this module only returns data. */
export const fetchGameLogsData = async (params = {}, { signal } = {}) => {
  const response = await apiClient
    .get(getApiUrl('GAME_LOGS'), {
      params,
      signal,
      // Game-log queries can legitimately be slower than ordinary API calls, but
      // not slower than the backend's own query limit.
      timeout: GAME_LOGS_TIMEOUT,
    })
    .catch((error) => {
      throw seasonRefusalOr(error);
    });

  return decodeGameLogsResponse(response.data);
};

export const isRequestCancelled = (error) =>
  Boolean(
    error &&
    (error.code === 'ERR_CANCELED' ||
      error.name === 'CanceledError' ||
      error.name === 'AbortError' ||
      error.message === 'canceled' ||
      error.message === 'The operation was aborted.'),
  );

/**
 * Ends a server failure's message (a 5xx response) with the first eight
 * characters of its X-Request-ID, so a user can quote it. A refusal (4xx), a
 * failure with no response, or one with no header keeps its message. axios
 * lowercases response header names.
 */
export const withRequestReference = (message, error) => {
  const requestId = error?.response?.headers?.['x-request-id'];
  return error?.response?.status >= 500 && typeof requestId === 'string' && requestId
    ? `${message} (ref ${requestId.slice(0, 8)})`
    : message;
};

export const getRequestErrorMessage = (
  error,
  fallback = 'The request failed. Please try again.',
) => {
  const responseError = error?.response?.data?.error;
  if (!responseError && ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) {
    return 'The request took too long. Please try again.';
  }
  // A 429 the backend did not write (a proxy's) still says to slow down.
  const rateLimited =
    error?.response?.status === 429 && 'Too many requests. Try again in a few seconds.';
  return withRequestReference(
    (typeof responseError === 'string' ? responseError : responseError?.message) ||
      error?.response?.data?.message ||
      rateLimited ||
      error?.message ||
      fallback,
    error,
  );
};
