import { apiClient, getApiUrl } from './config';
import { GAME_LOGS_TIMEOUT } from './apiSettings';

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
  };
};

/** Fetch and decode game logs. The caller owns state; this module only returns data. */
export const fetchGameLogsData = async (params = {}, { signal } = {}) => {
  const response = await apiClient.get(getApiUrl('GAME_LOGS'), {
    params,
    signal,
    // Game-log queries can legitimately be slower than ordinary API calls, but
    // not slower than the backend's own query limit.
    timeout: GAME_LOGS_TIMEOUT,
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
